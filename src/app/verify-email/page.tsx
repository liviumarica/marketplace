/**
 * /verify-email?status=success|invalid — landing page after clicking the
 * link in the verification email. The actual verification happens in
 * GET /api/auth/verify-email, which redirects here with the outcome.
 */
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { AuthShell } from "@/components/fx/AuthShell";

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { status } = await searchParams;
  const user = await getSessionUser();
  const ok = status === "success";

  return (
    <AuthShell
      eyebrow={ok ? "Email confirmed" : "Link problem"}
      title={ok ? "You're all set" : "This link doesn't work"}
      subtitle={
        ok
          ? "Your email address is confirmed. You can now publish listings, buy apps and post or accept custom builds."
          : user?.emailVerifiedAt
            ? "Your email is already confirmed — nothing else to do."
            : "The verification link is invalid, already used or expired (links last 24 hours). Request a fresh one below."
      }
      footer={
        user ? (
          <>
            Signed in as <span className="text-white/80">{user.email}</span>
          </>
        ) : (
          <>
            Want to continue?{" "}
            <Link href="/login" className="link-neon">
              Log in
            </Link>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {ok || user?.emailVerifiedAt ? (
          <>
            <Link href="/listings/new" className="btn-primary w-full !py-3">
              Sell your first app →
            </Link>
            <Link href="/" className="btn-ghost w-full">
              Browse the marketplace
            </Link>
          </>
        ) : user ? (
          // The floating reminder offers "Resend email" for signed-in users.
          <p className="alert-info text-sm">
            Use <strong>Resend email</strong> in the reminder at the bottom of the page, or in{" "}
            <Link href="/settings" className="link-neon">
              Settings
            </Link>
            , to get a new link.
          </p>
        ) : (
          <Link href="/login" className="btn-primary w-full !py-3">
            Log in to resend the link
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
