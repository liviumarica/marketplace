/**
 * POST /api/requests/[id]/offers — a developer makes an offer on a request.
 * Body: { priceCents, deliveryDays, message }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  priceCents: z.number().int().positive(),
  deliveryDays: z.number().int().min(1).max(365),
  message: z.string().min(10),
});

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

  const request = await prisma.customRequest.findUnique({ where: { id } });
  if (!request || request.status !== "OPEN") {
    return NextResponse.json(
      { error: "Request is not accepting offers" },
      { status: 404 },
    );
  }
  if (request.buyerId === user.id) {
    return NextResponse.json(
      { error: "You cannot offer on your own request" },
      { status: 400 },
    );
  }

  // One open offer per developer per request.
  const existing = await prisma.customOffer.findFirst({
    where: { requestId: id, developerId: user.id, status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending offer on this request" },
      { status: 409 },
    );
  }

  const offer = await prisma.customOffer.create({
    data: {
      requestId: id,
      developerId: user.id,
      priceCents: parsed.data.priceCents,
      deliveryDays: parsed.data.deliveryDays,
      message: parsed.data.message,
    },
  });

  await prisma.notification.create({
    data: {
      userId: request.buyerId,
      type: "OFFER_RECEIVED",
      title: `New offer on “${request.title}”`,
      body: `${user.name} offered $${(parsed.data.priceCents / 100).toFixed(2)} in ${parsed.data.deliveryDays} days.`,
    },
  });

  return NextResponse.json({ offerId: offer.id }, { status: 201 });
}
