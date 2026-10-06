/**
 * /api/listings
 *  GET  — list active listings (optionally ?q= filter)
 *  POST — create a new listing (seller role required). Starts as DRAFT;
 *         the AI verification agent promotes it to ACTIVE after a run.
 */
import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emailVerificationRequired, requireUser } from "@/lib/auth";
import { runListingVerification } from "@/lib/kernel";
import { indexListing } from "@/lib/elastic";
import { env } from "@/lib/env";

export const maxDuration = 300;

const createSchema = z.object({
  title: z.string().min(3),
  tagline: z.string().optional(),
  description: z.string().min(10),
  category: z.string().min(1),
  techStack: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  // $1 – $10M, whole cents. NaN/null (e.g. from "e1") fails with a clear message.
  priceCents: z
    .number({ invalid_type_error: "Enter a valid price in USD", required_error: "Enter a price in USD" })
    .int("Price can have at most 2 decimals")
    .min(100, "The price must be at least $1")
    .max(1_000_000_000, "The price can't be more than $10,000,000"),
  demoUrl: z.string().url().optional().or(z.literal("")),
  repoUrl: z.string().url().optional().or(z.literal("")),
  screenshots: z.array(z.string()).default([]),
});

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
              { category: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      tagline: true,
      category: true,
      priceCents: true,
      verificationStatus: true,
      aiQualityScore: true,
      seller: { select: { name: true } },
    },
  });
  return NextResponse.json({ listings });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  // Transacting requires a confirmed email address (anti-impersonation).
  const blocked = emailVerificationRequired(user);
  if (blocked) return blocked;
  if (user.role === "BUYER") {
    return NextResponse.json(
      { error: "Only sellers can create listings" },
      { status: 403 },
    );
  }
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    // Surface the first human-readable problem (e.g. the price message).
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: first?.message ?? "Invalid input",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // The verification agent can only run with a demo URL AND a configured
  // KERNEL key. Without either, the listing is published directly (marked
  // "not verified") instead of waiting forever for a run that can't happen.
  const canVerify = Boolean(d.demoUrl && env.kernelApiKey);

  const listing = await prisma.listing.create({
    data: {
      sellerId: user.id,
      title: d.title,
      slug: slugify(d.title),
      tagline: d.tagline || null,
      description: d.description,
      category: d.category,
      techStack: JSON.stringify(d.techStack),
      features: JSON.stringify(d.features),
      priceCents: d.priceCents,
      demoUrl: d.demoUrl || null,
      repoUrl: d.repoUrl || null,
      screenshots: JSON.stringify(d.screenshots),
      // Verifiable → PENDING_REVIEW until the agent passes it; otherwise the
      // listing is activated directly (verification is a bonus).
      status: canVerify ? "PENDING_REVIEW" : "ACTIVE",
    },
  });

  // Kick off the KERNEL verification agent in the background; the listing
  // page shows progress and publishes on PASSED.
  if (canVerify) {
    after(() => runListingVerification(listing.id));
  }

  // Index into Elasticsearch for semantic search (no-op if ES isn't running).
  after(() => indexListing(listing));

  return NextResponse.json({ listingId: listing.id }, { status: 201 });
}
