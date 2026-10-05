/**
 * GET /api/auth/verify-email?token=... — target of the link in the
 * verification email.
 *
 * Consumes the single-use token, marks the account verified, sends the
 * one-time welcome email, then redirects to /verify-email which renders the
 * outcome (?status=success | invalid).
 */
import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeAuthToken } from "@/lib/auth";
import { deliverWelcomeEmail } from "@/lib/auth-emails";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const result = (status: "success" | "invalid") =>
    NextResponse.redirect(new URL(`/verify-email?status=${status}`, req.url), 303);

  const userId = token ? await consumeAuthToken(token, "EMAIL_VERIFY") : null;
  if (!userId) return result("invalid");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return result("invalid");

  // Only the first confirmation flips the flag and triggers the welcome mail.
  if (!user.emailVerifiedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
    // Send after the redirect is returned so the user isn't kept waiting;
    // a failure here only loses the welcome message, never the verification.
    after(async () => {
      try {
        await deliverWelcomeEmail(user);
      } catch (err) {
        console.error(`Welcome email to user ${user.id} failed:`, err);
      }
    });
  }
  return result("success");
}
