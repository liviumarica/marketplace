/**
 * POST /api/custom-orders/[id]/accept
 * Buyer accepts the delivery — captures the PayPal authorization (releasing
 * the escrowed funds), then pays the developer their share minus the
 * platform commission via the Payouts API.
 *
 * Body: {} (no body needed)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { captureAuthorization, payoutToSeller } from "@/lib/paypal";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;

  const order = await prisma.customOrder.findUnique({
    where: { id },
    include: { request: true, developer: true },
  });
  if (!order || order.buyerId !== user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "DELIVERED") {
    return NextResponse.json(
      { error: `Cannot accept while order is ${order.status}` },
      { status: 400 },
    );
  }
  if (!order.paypalAuthorizationId) {
    return NextResponse.json(
      { error: "Missing PayPal authorization" },
      { status: 500 },
    );
  }

  // Release the escrowed funds — real capture on PayPal.
  await captureAuthorization(order.paypalAuthorizationId);

  const devAmount = order.amountCents - order.platformFeeCents;

  await prisma.$transaction([
    prisma.customOrder.update({
      where: { id },
      data: { status: "COMPLETED" },
    }),
    prisma.customRequest.update({
      where: { id: order.requestId },
      data: { status: "COMPLETED" },
    }),
    prisma.notification.create({
      data: {
        userId: order.developerId,
        type: "ESCROW_RELEASED",
        title: `Payment released for “${order.request.title}”`,
        body: `Escrow captured — your share $${(devAmount / 100).toFixed(2)} is being paid out.`,
      },
    }),
  ]);

  // Pay the developer their share — platform keeps the commission.
  if (order.developer.paypalEmail) {
    try {
      await payoutToSeller({
        sellerEmail: order.developer.paypalEmail,
        amountCents: devAmount,
        internalOrderId: order.id,
        note: `Custom build payout for “${order.request.title}”`,
      });
    } catch (err) {
      console.error("Developer payout failed:", err);
    }
  }

  return NextResponse.json({ ok: true, status: "COMPLETED" });
}
