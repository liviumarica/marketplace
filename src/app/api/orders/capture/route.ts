/**
 * POST /api/orders/capture
 * Captures a buyer-approved PayPal order, marks the internal order PAID,
 * flips the listing to SOLD, then settles the seller share (Payouts API in
 * "payout" mode — in "multi_unit" mode PayPal already split the money).
 *
 * Body: { paypalOrderId }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { captureOrder, payoutToSeller } from "@/lib/paypal";
import { env } from "@/lib/env";

const schema = z.object({ paypalOrderId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { paypalOrderId: parsed.data.paypalOrderId },
    include: { listing: true, seller: true },
  });
  if (!order || order.buyerId !== user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  // Idempotent: a retried capture of a paid order just returns success.
  if (order.status === "PAID") {
    return NextResponse.json({ orderId: order.id, status: "PAID" });
  }

  const captured = await captureOrder(order.paypalOrderId!);
  const captureId =
    captured.purchaseUnits?.[0]?.payments?.captures?.[0]?.id ?? null;

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID", paypalCaptureId: captureId },
    }),
    prisma.listing.update({
      where: { id: order.listingId },
      data: { status: "SOLD" },
    }),
    prisma.notification.create({
      data: {
        userId: order.sellerId,
        type: "ORDER_PAID",
        title: `Your app “${order.listing.title}” was sold`,
        body: `Sale total $${(order.totalCents / 100).toFixed(2)} — your share $${(order.sellerAmountCents / 100).toFixed(2)}.`,
      },
    }),
  ]);

  // Settle the seller's share when the platform collected the full amount.
  if (env.paypalSplitMode === "payout") {
    if (order.seller.paypalEmail) {
      try {
        await payoutToSeller({
          sellerEmail: order.seller.paypalEmail,
          amountCents: order.sellerAmountCents,
          internalOrderId: order.id,
          note: `Payout for “${order.listing.title}” on AgentBay`,
        });
      } catch (err) {
        // The sale is still valid — payout can be retried by an admin.
        console.error("Seller payout failed:", err);
      }
    } else {
      console.warn(
        `Order ${order.id}: seller ${order.sellerId} has no paypalEmail — payout skipped`,
      );
    }
  }

  return NextResponse.json({ orderId: order.id, status: "PAID" });
}
