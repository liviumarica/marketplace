/**
 * /api/requests — "Fiverr-style" custom build requests.
 *  GET  — list open requests (with offer counts)
 *  POST — buyer creates a request; `refinedBrief` comes from the AI refiner.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emailVerificationRequired, requireUser } from "@/lib/auth";

const createSchema = z.object({
  title: z.string().min(5),
  brief: z.string().min(20),
  refinedBrief: z.string().optional(),
  budgetCents: z.number().int().positive(),
  deadlineDays: z.number().int().min(1).max(365),
  category: z.string().optional(),
});

export async function GET() {
  const requests = await prisma.customRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      buyer: { select: { name: true } },
      _count: { select: { offers: true } },
    },
  });
  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  // Transacting requires a confirmed email address (anti-impersonation).
  const blocked = emailVerificationRequired(user);
  if (blocked) return blocked;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const request = await prisma.customRequest.create({
    data: {
      buyerId: user.id,
      title: d.title,
      brief: d.brief,
      refinedBrief: d.refinedBrief ?? null,
      budgetCents: d.budgetCents,
      deadlineDays: d.deadlineDays,
      category: d.category ?? null,
    },
  });
  return NextResponse.json({ requestId: request.id }, { status: 201 });
}
