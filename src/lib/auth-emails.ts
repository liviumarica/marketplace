/**
 * Glue between single-use auth tokens (lib/auth) and real email delivery
 * (lib/email): issue a token, build the absolute link, send the message.
 * Kept separate so lib/email stays a pure "send this message" module.
 */
import type { User } from "@/generated/prisma/client";
import { issueAuthToken, type AuthTokenType } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, sendVerificationEmail, sendWelcomeEmail } from "@/lib/email";

/**
 * Issue a token, build its link and send it. If delivery fails the token is
 * deleted again: no dangling unusable link, and the per-minute throttle
 * (based on the latest token) doesn't block an immediate retry.
 */
async function issueAndSend(
  userId: string,
  type: AuthTokenType,
  buildUrl: (token: string) => string,
  send: (url: string) => Promise<unknown>,
): Promise<void> {
  const token = await issueAuthToken(userId, type);
  try {
    await send(buildUrl(encodeURIComponent(token)));
  } catch (err) {
    await prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } });
    throw err;
  }
}

/** Email a fresh "confirm your address" link (invalidates older links). */
export async function deliverVerificationEmail(user: Pick<User, "id" | "email" | "name">): Promise<void> {
  await issueAndSend(
    user.id,
    "EMAIL_VERIFY",
    // The API route consumes the token and then redirects to /verify-email.
    (token) => `${env.appUrl}/api/auth/verify-email?token=${token}`,
    (url) => sendVerificationEmail(user.email, user.name, url),
  );
}

/** Email a fresh password-reset link (valid 1 hour, single use). */
export async function deliverPasswordResetEmail(user: Pick<User, "id" | "email" | "name">): Promise<void> {
  await issueAndSend(
    user.id,
    "PASSWORD_RESET",
    // The page shows a form; the token is only consumed when it is submitted,
    // so email security scanners that pre-open links cannot burn it.
    (token) => `${env.appUrl}/reset-password?token=${token}`,
    (url) => sendPasswordResetEmail(user.email, user.name, url),
  );
}

/** One-time welcome email, sent right after the address is confirmed. */
export async function deliverWelcomeEmail(user: Pick<User, "email" | "name">): Promise<void> {
  await sendWelcomeEmail(user.email, user.name, env.appUrl);
}
