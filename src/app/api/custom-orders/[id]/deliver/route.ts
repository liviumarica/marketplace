/**
 * POST /api/custom-orders/[id]/deliver
 * Developer delivers the finished app (repo/demo link + notes).
 * Starts the auto-release countdown — if the buyer doesn't respond, funds
 * are released automatically (standard marketplace escrow behaviour).
 *
 * Body: { deliveryUrl, notes? }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  deliveryUrl: z.string().url(),
  notes: z.string().optional(),
});

// Buyer gets 7 days to review the delivery before auto-release.
const AUTO_RELEASE_DAYS = 7;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const order = await prisma.customOrder.findUnique({
    where: { id },
    include: { request: true },
  });
  if (!order || order.developerId !== user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "FUNDED") {
    return NextResponse.json(
      { error: `Cannot deliver while order is ${order.status}` },
      { status: 400 },
    );
  }

  const autoReleaseAt = new Date(
    Date.now() + AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.$transaction([
    prisma.customOrder.update({
      where: { id },
      data: {
        status: "DELIVERED",
        deliveryUrl: parsed.data.deliveryUrl,
        deliveryNotes: parsed.data.notes ?? null,
        deliveredAt: new Date(),
        autoReleaseAt,
      },
    }),
    prisma.customRequest.update({
      where: { id: order.requestId },
      data: { status: "DELIVERED" },
    }),
    prisma.notification.create({
      data: {
        userId: order.buyerId,
        type: "DELIVERY",
        title: `Delivery for “${order.request.title}”`,
        body: `The developer delivered your app — review it within ${AUTO_RELEASE_DAYS} days or funds release automatically.`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, autoReleaseAt });
}
