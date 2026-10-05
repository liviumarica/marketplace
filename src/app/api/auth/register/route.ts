/**
 * POST /api/auth/register — create a new user account.
 * Body: { email, password, name, role? }
 * Role defaults to SELLER so new users can do everything on the demo
 * marketplace (buy AND sell); admins are seeded, not registered.
 *
 * The user is signed in immediately but starts UNVERIFIED: a real
 * verification email is sent, and transactional routes refuse to act until
 * the link in it is clicked (see emailVerificationRequired in lib/auth).
 * Returns { user, emailSent } — emailSent=false means the account exists but
 * the email provider failed; the user can resend from the banner.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";
import { deliverVerificationEmail } from "@/lib/auth-emails";

const schema = z.object({
  // Emails are stored lower-cased so "Bob@x.com" and "bob@x.com" are one account.
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1).max(80),
  role: z.enum(["BUYER", "SELLER"]).default("SELLER"),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Invalid input", details: parsed.error.flatten() },
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

  // Send the verification email. A provider outage must not lose the
  // freshly created account, so failures are logged and reported to the UI.
  let emailSent = true;
  try {
    await deliverVerificationEmail(user);
  } catch (err) {
    emailSent = false;
    console.error(`Verification email to user ${user.id} failed:`, err);
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    emailSent,
  });
}
