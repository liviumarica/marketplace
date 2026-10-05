/**
 * /reset-password?token=... — target of the link in the reset email.
 * The server page only reads the token from the URL; the client form posts
 * it with the new password, which is when the token is actually consumed.
 */
import Link from "next/link";
import { AuthShell } from "@/components/fx/AuthShell";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;

  if (typeof token !== "string" || !token) {
    return (
      <AuthShell
        eyebrow="Account recovery"
        title="Missing reset link"
        subtitle="Open the link from the password-reset email, or request a new one."
        footer={
          <Link href="/login" className="link-neon">
            Back to log in
          </Link>
        }
      >
        <Link href="/forgot-password" className="btn-primary w-full !py-3">
          Request a new link
        </Link>
      </AuthShell>
    );
  }
  return <ResetPasswordForm token={token} />;
}
