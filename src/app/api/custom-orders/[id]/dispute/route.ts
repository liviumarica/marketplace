/**
 * POST /api/custom-orders/[id]/dispute
 * Buyer disputes a delivery — voids the PayPal authorization, returning the
 * held funds to the buyer (the escrow is simply never captured).
 *
 * Body: { reason }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { voidAuthorization } from "@/lib/paypal";

const schema = z.object({ reason: z.string().min(5) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A reason is required to open a dispute" },
      { status: 400 },
    );
  }

  const order = await prisma.customOrder.findUnique({
    where: { id },
    include: { request: true },
  });
  if (!order || order.buyerId !== user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!["FUNDED", "DELIVERED"].includes(order.status)) {
    return NextResponse.json(
      { error: `Cannot dispute while order is ${order.status}` },
      { status: 400 },
    );
  }

  // Voiding the authorization releases the hold — buyer's funds come back.
  if (order.paypalAuthorizationId) {
    await voidAuthorization(order.paypalAuthorizationId);
  }

  await prisma.$transaction([
    prisma.customOrder.update({
      where: { id },
      data: { status: "REFUNDED" },
    }),
    prisma.customRequest.update({
      where: { id: order.requestId },
      data: { status: "OPEN" }, // request can be re-opened for other offers
    }),
    prisma.notification.create({
      data: {
        userId: order.developerId,
        type: "DISPUTE",
        title: `Dispute on “${order.request.title}”`,
        body: `The buyer disputed the delivery: ${parsed.data.reason}. Escrow was released back.`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, status: "REFUNDED" });
}
