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
import { emailVerificationRequired, requireUser } from "@/lib/auth";
import { createSaleOrder } from "@/lib/paypal";
import { env } from "@/lib/env";
import { platformFee } from "@/lib/money";
import { isPayoutReady, SELLER_NOT_PAYOUT_READY } from "@/lib/payout";

const schema = z.object({ listingId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await requireUser();
  // Transacting requires a confirmed email address (anti-impersonation).
  const blocked = emailVerificationRequired(user);
  if (blocked) return blocked;
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
  // The seller must be able to receive their share (merchant id in
  // multi_unit mode, PayPal email in payout mode) — sellers may publish
  // before adding these, so this is where it is enforced.
  if (!isPayoutReady(listing.seller)) {
    return NextResponse.json({ error: SELLER_NOT_PAYOUT_READY }, { status: 409 });
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
