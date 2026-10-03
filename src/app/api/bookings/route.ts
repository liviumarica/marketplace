/**
 * /api/bookings
 *  POST — buyer books a live demo slot with the seller of a listing.
 *  GET  — list bookings for the current user (as buyer or as seller).
 * Body: { listingId, startTime (ISO), endTime (ISO), notes? }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const createSchema = z.object({
  listingId: z.string().min(1),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { listingId, startTime, endTime, notes } = parsed.data;

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== "ACTIVE") {
    return NextResponse.json({ error: "Listing not available" }, { status: 404 });
  }
  if (listing.sellerId === user.id) {
    return NextResponse.json(
      { error: "You cannot book a demo for your own listing" },
      { status: 400 },
    );
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (end <= start) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 },
    );
  }

  // Prevent double-booking the seller on overlapping slots.
  const conflict = await prisma.demoBooking.findFirst({
    where: {
      listing: { sellerId: listing.sellerId },
      status: "SCHEDULED",
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });
  if (conflict) {
    return NextResponse.json(
      { error: "The seller already has a demo booked in that slot" },
      { status: 409 },
    );
  }

  const booking = await prisma.demoBooking.create({
    data: {
      listingId,
      buyerId: user.id,
      startTime: start,
      endTime: end,
      notes: notes ?? null,
    },
  });

  await prisma.notification.create({
    data: {
      userId: listing.sellerId,
      type: "DEMO_BOOKED",
      title: `Demo booked for “${listing.title}”`,
      body: `${user.name} booked a demo on ${start.toLocaleString()}.`,
    },
  });

  return NextResponse.json({ bookingId: booking.id }, { status: 201 });
}

export async function GET() {
  const user = await requireUser();
  const bookings = await prisma.demoBooking.findMany({
    where: {
      OR: [{ buyerId: user.id }, { listing: { sellerId: user.id } }],
      status: "SCHEDULED",
    },
    include: {
      listing: { select: { id: true, title: true } },
      buyer: { select: { name: true, email: true } },
    },
    orderBy: { startTime: "asc" },
  });
  return NextResponse.json({ bookings });
}
