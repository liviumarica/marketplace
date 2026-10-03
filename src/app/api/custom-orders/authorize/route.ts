/**
 * POST /api/custom-orders/authorize
 * Called after the buyer approves the PayPal order — runs the AUTHORIZE,
 * which places a real hold on the buyer's funds (escrow funded).
 *
 * Body: { paypalOrderId }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { authorizeOrder } from "@/lib/paypal";

const schema = z.object({ paypalOrderId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const customOrder = await prisma.customOrder.findUnique({
    where: { paypalOrderId: parsed.data.paypalOrderId },
    include: { request: true, developer: true },
  });
  if (!customOrder || customOrder.buyerId !== user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (customOrder.status === "FUNDED") {
    return NextResponse.json({ customOrderId: customOrder.id, status: "FUNDED" });
  }

  const { authorizationId } = await authorizeOrder(customOrder.paypalOrderId!);

  // Atomically: fund the escrow, mark the request in progress, accept the
  // winning offer and decline the rest.
  await prisma.$transaction([
    prisma.customOrder.update({
      where: { id: customOrder.id },
      data: { status: "FUNDED", paypalAuthorizationId: authorizationId },
    }),
    prisma.customRequest.update({
      where: { id: customOrder.requestId },
      data: { status: "IN_PROGRESS" },
    }),
    prisma.customOffer.update({
      where: { id: customOrder.offerId },
      data: { status: "ACCEPTED" },
    }),
    prisma.customOffer.updateMany({
      where: {
        requestId: customOrder.requestId,
        id: { not: customOrder.offerId },
        status: "PENDING",
      },
      data: { status: "DECLINED" },
    }),
    prisma.notification.create({
      data: {
        userId: customOrder.developerId,
        type: "ESCROW_FUNDED",
        title: `Escrow funded for “${customOrder.request.title}”`,
        body: `The buyer funded $${(customOrder.amountCents / 100).toFixed(2)} — you can start building.`,
      },
    }),
  ]);

  return NextResponse.json({ customOrderId: customOrder.id, status: "FUNDED" });
}
