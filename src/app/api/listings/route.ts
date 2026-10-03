/**
 * /api/listings
 *  GET  — list active listings (optionally ?q= filter)
 *  POST — create a new listing (seller role required). Starts as DRAFT;
 *         the AI verification agent promotes it to ACTIVE after a run.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { runListingVerification } from "@/lib/kernel";
import { indexListing } from "@/lib/elastic";

const createSchema = z.object({
  title: z.string().min(3),
  tagline: z.string().optional(),
  description: z.string().min(10),
  category: z.string().min(1),
  techStack: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  priceCents: z.number().int().positive(),
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
  if (user.role === "BUYER") {
    return NextResponse.json(
      { error: "Only sellers can create listings" },
      { status: 403 },
    );
  }
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;

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
      // A demo URL means the verification agent can run — go to PENDING_REVIEW;
      // otherwise the listing is activated directly (verification is a bonus).
      status: d.demoUrl ? "PENDING_REVIEW" : "ACTIVE",
    },
  });

  // A demo URL means the KERNEL verification agent can run — kick it off in
  // the background; the listing page shows progress and publishes on PASSED.
  if (listing.demoUrl) {
    void runListingVerification(listing.id);
  }

  // Index into Elasticsearch for semantic search (no-op if ES isn't running).
  void indexListing(listing);

  return NextResponse.json({ listingId: listing.id }, { status: 201 });
}
