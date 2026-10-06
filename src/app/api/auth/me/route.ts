/**
 * GET /api/auth/me — return the current session user (or null).
 *
 * The answer is per-user, so it is marked `no-store` (and `Vary: Cookie`):
 * no browser, proxy or CDN may cache it, otherwise after a logout/login
 * switch in the same browser a form could be pre-filled with the PREVIOUS
 * user's data (e.g. their PayPal email).
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null }, { headers: NO_STORE });
  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        paypalEmail: user.paypalEmail,
        paypalMerchantId: user.paypalMerchantId,
        bio: user.bio,
        emailVerified: Boolean(user.emailVerifiedAt),
      },
    },
    { headers: NO_STORE },
  );
}
