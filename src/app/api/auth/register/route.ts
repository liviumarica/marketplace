/**
 * POST /api/auth/register — create a new user account.
 * Body: { email, password, name, role? }
 * Role defaults to SELLER so new users can do everything on the demo
 * marketplace (buy AND sell); admins are seeded, not registered.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(["BUYER", "SELLER"]).default("SELLER"),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { email, password, name, role } = parsed.data;

  // Reject duplicate emails early with a friendly error.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  const user = await prisma.user.create({
    data: { email, name, role, passwordHash: await hashPassword(password) },
  });
  await setSessionCookie(await createSessionToken(user));

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}
