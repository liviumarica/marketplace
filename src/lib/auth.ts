/**
 * Authentication — lightweight session management.
 *
 * Sessions are server-side: every sign-in creates a `Session` row, and the
 * httpOnly cookie holds a JWT (signed with AUTH_SECRET via `jose`) that
 * carries that row's id. A request is authenticated only if the signature is
 * valid AND the row still exists and hasn't expired — so logging out deletes
 * the row and the session is dead on the server immediately, even for a
 * copied cookie or a tab that was open before. Passwords are hashed with
 * bcrypt. No external auth provider, no simulation.
 *
 * On top of the session this module also owns:
 *   - single-use email tokens (email verification + password reset), stored
 *     only as SHA-256 hashes,
 *   - "sign out everywhere" (password reset / change) — deletes all session
 *     rows of the user and bumps `User.sessionVersion` as a second guard,
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
  /** Snapshot of User.sessionVersion at login time. */
  sv?: number;
  /** Id of the server-side Session row (tokens without it are rejected). */
  sid?: string;
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

/**
 * Start a new server-side session for `user` and return its signed JWT.
 * Also prunes this user's expired session rows so the table stays small.
 */
export async function createSessionToken(user: User): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const [, session] = await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } }),
    prisma.session.create({ data: { userId: user.id, expiresAt } }),
  ]);
  return new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
    sv: user.sessionVersion,
    sid: session.id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secretKey());
}

/** Verify the cookie's JWT and return its payload, or null if invalid. */
async function readSessionPayload(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, secretKey());
    return payload;
  } catch {
    return null; // expired / tampered token — treat as logged out
  }
}

/** Revoke every session of a user ("sign out on all devices"). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
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
 * Log out: delete the current session row on the server (so the token is
 * useless even if a copy survives in another tab or tool), then clear the
 * cookie. The cookie is cleared with the same attributes as
 * `setSessionCookie`, an empty value, an epoch expiry AND Max-Age=0 so every
 * browser drops it immediately.
 */
export async function clearSessionCookie(): Promise<void> {
  const payload = await readSessionPayload();
  if (payload?.sid) {
    await prisma.session.deleteMany({ where: { id: payload.sid } });
  }
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Return the currently authenticated user, or null.
 * Verifies the JWT signature, then loads the session row together with a
 * fresh user row (so role / PayPal changes apply without re-login). The
 * request is anonymous when the row was deleted (logout / revoked), has
 * expired, belongs to someone else, or predates a password change.
 * Legacy tokens without a session id are rejected.
 */
export async function getSessionUser(): Promise<User | null> {
  const payload = await readSessionPayload();
  if (!payload?.sid) return null;
  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    include: { user: true },
  });
  if (
    !session ||
    session.expiresAt <= new Date() ||
    session.userId !== payload.userId ||
    (payload.sv ?? 0) !== session.user.sessionVersion
  ) {
    return null;
  }
  return session.user;
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
