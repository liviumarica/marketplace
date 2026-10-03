/**
 * POST /api/ai/price-suggest
 * Suggests a listing price for an AI-built SaaS app. The model reasons over
 * the listing details plus comparable ACTIVE/SOLD listings on this
 * marketplace — grounding the suggestion in real local data.
 *
 * Body: { title, description, category, techStack[], features[] }
 * Returns: { suggestedCents, minCents, maxCents, rationale }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import { chatModel } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const bodySchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  techStack: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
});

const suggestionSchema = z.object({
  suggestedCents: z
    .number()
    .int()
    .describe("Suggested asking price in USD cents"),
  minCents: z.number().int().describe("Low end of a reasonable price range"),
  maxCents: z.number().int().describe("High end of a reasonable price range"),
  rationale: z
    .string()
    .describe("2-3 sentences explaining the pricing reasoning"),
});

export async function POST(req: NextRequest) {
  await requireUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Real comparables from this marketplace give the model a pricing anchor.
  const comparables = await prisma.listing.findMany({
    where: { status: { in: ["ACTIVE", "SOLD"] } },
    select: {
      title: true,
      category: true,
      priceCents: true,
      status: true,
      aiQualityScore: true,
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  const { object } = await generateObject({
    model: chatModel(),
    schema: suggestionSchema,
    prompt:
      `Suggest a fair one-time acquisition price (complete business: source ` +
      `code, brand, docs) for this AI-built SaaS listing.\n\n` +
      `Listing:\n${JSON.stringify(parsed.data, null, 2)}\n\n` +
      `Comparable listings on this marketplace (price in cents, status ` +
      `ACTIVE or SOLD):\n${JSON.stringify(comparables, null, 2)}\n\n` +
      `Typical micro-SaaS acquisitions price at 1-3x annual revenue or, for ` +
      `pre-revenue AI-built apps, in the $50-$5000 range depending on ` +
      `completeness and quality.`,
  });

  return NextResponse.json(object);
}
