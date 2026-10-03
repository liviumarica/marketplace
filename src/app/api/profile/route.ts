/**
 * PATCH /api/profile — update the current user's profile fields.
 * Sellers set their PayPal sandbox identity here so sales can pay them.
 * Body: { paypalEmail?, paypalMerchantId?, bio? }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  paypalEmail: z.string().email().optional().or(z.literal("")),
  paypalMerchantId: z.string().optional().or(z.literal("")),
  bio: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { paypalEmail, paypalMerchantId, bio } = parsed.data;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(paypalEmail !== undefined
        ? { paypalEmail: paypalEmail || null }
        : {}),
      ...(paypalMerchantId !== undefined
        ? { paypalMerchantId: paypalMerchantId || null }
        : {}),
      ...(bio !== undefined ? { bio } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
