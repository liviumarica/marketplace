/**
 * POST /api/ai/listing-autofill
 * Turns a URL (GitHub repo or demo page) into a complete listing draft —
 * title, tagline, description, category, tech stack, features — via the LLM.
 *
 * Body: { url }
 * Returns: { title, tagline, description, category, techStack[], features[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import { chatModel } from "@/lib/ai";
import { fetchUrlContent } from "@/lib/url-content";
import { requireUser } from "@/lib/auth";

const bodySchema = z.object({ url: z.string().url() });

const listingSchema = z.object({
  title: z.string().describe("Short product name for the SaaS app"),
  tagline: z.string().describe("One punchy sentence describing the app"),
  description: z
    .string()
    .describe(
      "2-3 paragraph sales description: what it does, who it's for, why it's valuable",
    ),
  category: z
    .enum([
      "Productivity",
      "Finance",
      "Marketing",
      "Developer Tools",
      "E-Commerce",
      "Analytics",
      "HR & Recruiting",
      "Customer Support",
      "Education",
      "Other",
    ])
    .describe("Best-fit marketplace category"),
  techStack: z
    .array(z.string())
    .describe("Technologies/frameworks used (e.g. Next.js, Python, Stripe)"),
  features: z
    .array(z.string())
    .describe("5-8 concrete product features, each a short phrase"),
});

export async function POST(req: NextRequest) {
  await requireUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid URL is required" },
      { status: 400 },
    );
  }

  // Fetch real page/repo content — the model works from actual data.
  const content = await fetchUrlContent(parsed.data.url);

  const { object } = await generateObject({
    model: chatModel(),
    schema: listingSchema,
    prompt:
      `You are creating a marketplace listing for an AI-built SaaS application ` +
      `that is being sold as a complete business (code + brand included).\n\n` +
      `Source content fetched from ${parsed.data.url}:\n\n${content}\n\n` +
      `Write a compelling, accurate listing. Be factual — only claim what the ` +
      `source content supports.`,
  });

  return NextResponse.json(object);
}
