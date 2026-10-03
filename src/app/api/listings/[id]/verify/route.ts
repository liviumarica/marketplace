/**
 * POST /api/listings/[id]/verify
 * Kicks off a KERNEL verification run for the listing (owner or admin only).
 * Returns immediately — the run executes in the background and the listing
 * page reflects progress on reload.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { runListingVerification } from "@/lib/kernel";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (listing.sellerId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!listing.demoUrl) {
    return NextResponse.json(
      { error: "Add a demo URL to run verification" },
      { status: 400 },
    );
  }
  if (listing.verificationStatus === "RUNNING") {
    return NextResponse.json({ error: "Verification already running" }, { status: 409 });
  }

  // Fire-and-forget: the run takes ~30-60s in the KERNEL cloud browser.
  void runListingVerification(id);

  return NextResponse.json({ started: true });
}
