/**
 * Authentication — lightweight session management.
 *
 * Sessions are stateless JWTs stored in an httpOnly cookie, signed with
 * AUTH_SECRET using `jose`. Passwords are hashed with bcrypt. This keeps the
 * hackathon demo fully self-contained (no external auth provider needed)
 * while remaining a real, working auth system — no simulation.
 */
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
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
}

/** Create a signed session JWT for a user. */
export async function createSessionToken(user: User): Promise<string> {
  return new SignJWT({ userId: user.id, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

/** Persist the session token in an httpOnly cookie. */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

/** Clear the session cookie (logout). */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Return the currently authenticated user, or null.
 * Verifies the JWT signature, then loads a fresh user row so that role /
 * PayPal changes take effect without re-login.
 */
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, secretKey());
    return await prisma.user.findUnique({ where: { id: payload.userId } });
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
