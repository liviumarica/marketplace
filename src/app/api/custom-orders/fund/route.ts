/**
 * POST /api/custom-orders/fund
 * Buyer accepts an offer — creates the CustomOrder and a PayPal order with
 * intent=AUTHORIZE so the funds are held (escrow), not captured yet.
 *
 * Body: { offerId }
 * Returns: { customOrderId, paypalOrderId }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emailVerificationRequired, requireUser } from "@/lib/auth";
import { createAuthorizeOrder } from "@/lib/paypal";
import { env } from "@/lib/env";
import { platformFee } from "@/lib/money";

const schema = z.object({ offerId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await requireUser();
  // Transacting requires a confirmed email address (anti-impersonation).
  const blocked = emailVerificationRequired(user);
  if (blocked) return blocked;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const offer = await prisma.customOffer.findUnique({
    where: { id: parsed.data.offerId },
    include: { request: true, developer: true },
  });
  if (!offer || offer.status !== "PENDING") {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }
  if (offer.request.buyerId !== user.id) {
    return NextResponse.json(
      { error: "Only the request owner can accept an offer" },
      { status: 403 },
    );
  }

  const feeCents = platformFee(offer.priceCents, env.platformFeeBps);

  const customOrder = await prisma.customOrder.create({
    data: {
      requestId: offer.requestId,
      offerId: offer.id,
      buyerId: user.id,
      developerId: offer.developerId,
      amountCents: offer.priceCents,
      platformFeeCents: feeCents,
    },
  });

  try {
    const paypalOrder = await createAuthorizeOrder({
      totalCents: offer.priceCents,
      referenceId: customOrder.id,
      description: `AgentBay escrow: ${offer.request.title}`,
    });
    await prisma.customOrder.update({
      where: { id: customOrder.id },
      data: { paypalOrderId: paypalOrder.id },
    });
    return NextResponse.json({
      customOrderId: customOrder.id,
      paypalOrderId: paypalOrder.id,
    });
  } catch (err) {
    await prisma.customOrder.delete({ where: { id: customOrder.id } });
    throw err;
  }
}
