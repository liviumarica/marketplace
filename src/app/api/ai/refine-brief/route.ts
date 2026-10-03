/**
 * POST /api/ai/refine-brief
 * Turns a buyer's rough app idea into a structured spec developers can bid
 * on: user stories, must-have features, tech recommendations, estimated
 * effort — and a suggested budget.
 *
 * Body: { title, brief }
 * Returns: { refinedBrief, suggestedBudgetCents, estimatedDays }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import { chatModel } from "@/lib/ai";
import { requireUser } from "@/lib/auth";

const bodySchema = z.object({
  title: z.string().min(3),
  brief: z.string().min(10),
});

const specSchema = z.object({
  refinedBrief: z
    .string()
    .describe(
      "A structured spec: goal, target users, must-have features (bullets), " +
        "nice-to-haves, suggested tech stack, acceptance criteria",
    ),
  suggestedBudgetCents: z
    .number()
    .int()
    .describe("Fair budget in USD cents for an AI-assisted build"),
  estimatedDays: z
    .number()
    .int()
    .describe("Realistic delivery time in days for an AI-augmented developer"),
});

export async function POST(req: NextRequest) {
  await requireUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { object } = await generateObject({
    model: chatModel(),
    schema: specSchema,
    prompt:
      `A marketplace buyer wants a developer to build a small application ` +
      `with AI assistance (cheap, fast delivery). Turn their rough request ` +
      `into a clear, structured spec that developers can price against.\n\n` +
      `Title: ${parsed.data.title}\n\nRough brief:\n${parsed.data.brief}\n\n` +
      `Budget guidance: AI-assisted builds of small apps typically cost ` +
      `$200-$2,000 and ship in 3-21 days depending on complexity.`,
  });

  return NextResponse.json(object);
}
