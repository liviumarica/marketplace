/**
 * POST /api/listings/[id]/verify
 * Kicks off a KERNEL verification run for the listing (owner or admin only).
 * Returns immediately — the run executes in the background and the listing
 * page reflects progress on reload.
 */
import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { runListingVerification } from "@/lib/kernel";
import { env } from "@/lib/env";

export const maxDuration = 300;

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
  // Platform-side requirement: without KERNEL the run could only fail.
  if (!env.kernelApiKey) {
    return NextResponse.json(
      { error: "AI verification is not available on this marketplace right now." },
      { status: 503 },
    );
  }
  if (listing.verificationStatus === "RUNNING") {
    return NextResponse.json({ error: "Verification already running" }, { status: 409 });
  }

  // Keep the serverless invocation alive until verification finishes.
  after(() => runListingVerification(id));

  return NextResponse.json({ started: true });
}
