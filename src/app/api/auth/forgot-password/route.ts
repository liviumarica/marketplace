/**
 * POST /api/auth/forgot-password — start the password-recovery flow.
 * Body: { email }
 *
 * Always answers 200 with the same message whether or not the account
 * exists, so the endpoint cannot be used to discover registered emails.
 * When the account exists (and is not throttled) a real reset email is sent.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emailCooldownSeconds } from "@/lib/auth";
import { deliverPasswordResetEmail } from "@/lib/auth-emails";

const schema = z.object({ email: z.string().trim().email() });

const GENERIC_OK = {
  ok: true,
  message: "If an account exists for that email, a reset link is on its way.",
};

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }
  const email = parsed.data.email;

  // Same normalisation fallback as login (old accounts may be mixed-case).
  const user =
    (await prisma.user.findUnique({ where: { email: email.toLowerCase() } })) ??
    (await prisma.user.findUnique({ where: { email } }));

  if (user && (await emailCooldownSeconds(user.id, "PASSWORD_RESET")) === 0) {
    try {
      await deliverPasswordResetEmail(user);
    } catch (err) {
      // Surface provider outages — the user should know to retry later.
      console.error(`Password reset email to user ${user.id} failed:`, err);
      return NextResponse.json(
        { error: "We couldn't send the email right now. Please try again in a few minutes." },
        { status: 502 },
      );
    }
  }
  return NextResponse.json(GENERIC_OK);
}
