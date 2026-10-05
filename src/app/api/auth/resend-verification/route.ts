/**
 * POST /api/auth/resend-verification — email a new verification link to the
 * signed-in user. Throttled to one email per minute per user; older links
 * stop working as soon as a new one is issued.
 */
import { NextResponse } from "next/server";
import { emailCooldownSeconds, getSessionUser } from "@/lib/auth";
import { deliverVerificationEmail } from "@/lib/auth-emails";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (user.emailVerifiedAt) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const wait = await emailCooldownSeconds(user.id, "EMAIL_VERIFY");
  if (wait > 0) {
    return NextResponse.json(
      { error: `Please wait ${wait}s before requesting another email.` },
      { status: 429 },
    );
  }

  try {
    await deliverVerificationEmail(user);
  } catch (err) {
    console.error(`Resend verification to user ${user.id} failed:`, err);
    return NextResponse.json(
      { error: "We couldn't send the email right now. Please try again in a few minutes." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
