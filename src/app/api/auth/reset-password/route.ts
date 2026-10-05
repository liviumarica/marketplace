/**
 * POST /api/auth/reset-password — finish the password-recovery flow.
 * Body: { token, password }
 *
 * Consumes the single-use reset token, stores the new password hash and
 * bumps sessionVersion so every existing session (on any device) is signed
 * out. Clicking an emailed link also proves inbox ownership, so the email is
 * marked verified if it wasn't already.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clearSessionCookie, consumeAuthToken, hashPassword } from "@/lib/auth";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { token, password } = parsed.data;

  const userId = await consumeAuthToken(token, "PASSWORD_RESET");
  if (!userId) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Please request a new one." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(password),
      sessionVersion: { increment: 1 },
      ...(user?.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
    },
  });
  // Any other outstanding reset links for this user are now pointless.
  await prisma.authToken.deleteMany({ where: { userId, type: "PASSWORD_RESET", usedAt: null } });

  // The browser doing the reset may hold an old session — drop it too.
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
