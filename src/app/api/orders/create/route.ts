/**
 * POST /api/orders/create
 * Creates an internal Order + the matching PayPal order for a listing
 * purchase. The frontend PayPal button uses the returned paypalOrderId to
 * drive buyer approval.
 *
 * Body: { listingId }
 * Returns: { orderId, paypalOrderId }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createSaleOrder } from "@/lib/paypal";
import { env } from "@/lib/env";
import { platformFee } from "@/lib/money";

const schema = z.object({ listingId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: parsed.data.listingId },
    include: { seller: true },
  });
  if (!listing || listing.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Listing is not available for purchase" },
      { status: 404 },
    );
  }
  if (listing.sellerId === user.id) {
    return NextResponse.json(
      { error: "You cannot buy your own listing" },
      { status: 400 },
    );
  }
  // In multi_unit mode the seller MUST have a PayPal merchant id to receive
  // their share; in payout mode we need at least their PayPal email.
  if (
    env.paypalSplitMode === "multi_unit" &&
    !listing.seller.paypalMerchantId
  ) {
    return NextResponse.json(
      { error: "Seller has not connected a PayPal merchant account" },
      { status: 400 },
    );
  }

  const feeCents = platformFee(listing.priceCents, env.platformFeeBps);

  // Persist the internal order first so the PayPal order can reference it.
  const order = await prisma.order.create({
    data: {
      buyerId: user.id,
      sellerId: listing.sellerId,
      listingId: listing.id,
      totalCents: listing.priceCents,
      platformFeeCents: feeCents,
      sellerAmountCents: listing.priceCents - feeCents,
    },
  });

  try {
    const paypalOrder = await createSaleOrder({
      sellerMerchantId: listing.seller.paypalMerchantId,
      sellerEmail: listing.seller.paypalEmail,
      totalCents: listing.priceCents,
      referenceId: order.id,
      description: `AgentBay: ${listing.title} (business acquisition)`,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paypalOrderId: paypalOrder.id },
    });

    return NextResponse.json({ orderId: order.id, paypalOrderId: paypalOrder.id });
  } catch (err) {
    // Roll the internal order back so the listing stays purchasable.
    await prisma.order.delete({ where: { id: order.id } });
    throw err;
  }
}
