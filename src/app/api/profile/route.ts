/**
 * PATCH /api/profile — update the current user's profile fields.
 * Used by the Settings page (name, bio) and by sellers to set their PayPal
 * sandbox payout identity so sales can pay them.
 * Body: { name?, bio?, paypalEmail?, paypalMerchantId? } — omitted fields
 * are left untouched, empty strings clear optional fields.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(80).optional(),
  paypalEmail: z.string().trim().email("Enter a valid PayPal email").optional().or(z.literal("")),
  paypalMerchantId: z.string().trim().max(32).optional().or(z.literal("")),
  bio: z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest) {
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
  const { name, paypalEmail, paypalMerchantId, bio } = parsed.data;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(paypalEmail !== undefined
        ? { paypalEmail: paypalEmail || null }
        : {}),
      ...(paypalMerchantId !== undefined
        ? { paypalMerchantId: paypalMerchantId || null }
        : {}),
      ...(bio !== undefined ? { bio: bio || null } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
