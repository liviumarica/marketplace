/**
 * Authentication — lightweight session management.
 *
 * Sessions are stateless JWTs stored in an httpOnly cookie, signed with
 * AUTH_SECRET using `jose`. Passwords are hashed with bcrypt. This keeps the
 * hackathon demo fully self-contained (no external auth provider needed)
 * while remaining a real, working auth system — no simulation.
 *
 * On top of the session this module also owns:
 *   - single-use email tokens (email verification + password reset), stored
 *     only as SHA-256 hashes,
 *   - session revocation through `User.sessionVersion` (bumped on password
 *     reset / change so stolen or forgotten sessions stop working),
 *   - the "email must be verified" gate used by transactional API routes.
 */
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { User } from "@/generated/prisma/client";

const COOKIE_NAME = "mp_session";
const SESSION_DAYS = 7;

function secretKey() {
  return new TextEncoder().encode(env.authSecret);
}

/** Payload embedded in the signed session token. */
export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  /** Snapshot of User.sessionVersion at login time (absent on old tokens). */
  sv?: number;
}

/**
 * Cookie attributes shared by "set" and "clear". Browsers only overwrite a
 * cookie when name + path (+ domain) match, and Chrome refuses to replace a
 * `Secure` cookie with a non-secure one — so clearing MUST reuse exactly the
 * same attributes that were used when the cookie was created.
 */
function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

/** Create a signed session JWT for a user. */
export async function createSessionToken(user: User): Promise<string> {
  return new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
    sv: user.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

/** Persist the session token in an httpOnly cookie. */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    ...sessionCookieOptions(),
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

/**
 * Clear the session cookie (logout). Uses the same attributes as
 * `setSessionCookie`, an empty value, an epoch expiry AND Max-Age=0 so every
 * browser drops it immediately.
 */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Return the currently authenticated user, or null.
 * Verifies the JWT signature, then loads a fresh user row so that role /
 * PayPal changes take effect without re-login. Tokens issued before the
 * user's last password reset/change (older sessionVersion) are rejected.
 */
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, secretKey());
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || (payload.sv ?? 0) !== user.sessionVersion) return null;
    return user;
  } catch {
    return null; // expired / tampered token — treat as logged out
  }
}

/** Same as getSessionUser but throws — for routes that require a session. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Authentication required");
  return user;
}

export class AuthError extends Error {}

/**
 * Gate for transactional routes (publish, buy, offer, fund, book...).
 * Returns a ready-made 403 response when the user has not verified their
 * email yet, or null when they may proceed:
 *
 *   const blocked = emailVerificationRequired(user);
 *   if (blocked) return blocked;
 */
export function emailVerificationRequired(user: User): NextResponse | null {
  if (user.emailVerifiedAt) return null;
  return NextResponse.json(
    {
      error:
        "Please verify your email address first — check your inbox, or resend the link from the reminder at the bottom of the page or from Settings.",
      code: "EMAIL_NOT_VERIFIED",
    },
    { status: 403 },
  );
}

/** Hash a plaintext password for storage. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** Verify a plaintext password against a stored hash. */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// =============================================================================
// Single-use email tokens
// =============================================================================

export type AuthTokenType = "EMAIL_VERIFY" | "PASSWORD_RESET";

/** How long each kind of link stays valid. */
const TOKEN_TTL_MINUTES: Record<AuthTokenType, number> = {
  EMAIL_VERIFY: 24 * 60, // 24 hours — users often verify later in the day
  PASSWORD_RESET: 60, // 1 hour — reset links are more sensitive
};

/** SHA-256 hex digest — only this is stored, never the raw token. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Create a fresh token for `userId` and return the RAW value (to put in the
 * emailed link). Any previous unused token of the same type is invalidated,
 * so only the most recent email works.
 */
export async function issueAuthToken(
  userId: string,
  type: AuthTokenType,
): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } }),
    prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES[type] * 60_000),
      },
    }),
  ]);
  return raw;
}

/**
 * Atomically consume a token: succeeds only if it exists, has the right
 * type, is unused and not expired. Returns the owner's id, or null.
 * The conditional `updateMany` guarantees a link can be used exactly once
 * even if it is clicked twice concurrently.
 */
export async function consumeAuthToken(
  raw: string,
  type: AuthTokenType,
): Promise<string | null> {
  const tokenHash = hashToken(raw);
  const { count } = await prisma.authToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (count !== 1) return null;
  const token = await prisma.authToken.findUnique({ where: { tokenHash } });
  return token?.userId ?? null;
}

/**
 * Seconds the user must still wait before another email of this type may be
 * sent (simple per-user throttle against inbox flooding). 0 = allowed now.
 */
export async function emailCooldownSeconds(
  userId: string,
  type: AuthTokenType,
  cooldownSeconds = 60,
): Promise<number> {
  const last = await prisma.authToken.findFirst({
    where: { userId, type },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last) return 0;
  const elapsed = (Date.now() - last.createdAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(cooldownSeconds - elapsed));
}
