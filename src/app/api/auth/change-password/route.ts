/**
 * POST /api/auth/change-password — change the password of the signed-in user.
 * Body: { currentPassword, newPassword }
 *
 * Requires the current password, bumps sessionVersion (signing out every
 * other device) and re-issues a fresh session cookie for this browser so
 * the user stays signed in here.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  getSessionUser,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { currentPassword, newPassword } = parsed.data;

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      sessionVersion: { increment: 1 },
    },
  });
  // New token carries the new sessionVersion → this browser stays signed in.
  await setSessionCookie(await createSessionToken(updated));
  return NextResponse.json({ ok: true });
}
