"use client";

/**
 * Registration form — creates a real account via /api/auth/register.
 * New users get the SELLER role so they can both list apps and buy.
 *
 * After sign-up the server emails a verification link; we switch to a
 * "check your inbox" state instead of silently redirecting, so the user
 * knows they still have to confirm their address before transacting.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/fx/AuthShell";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // null = form; otherwise whether the verification email went out.
  const [sent, setSent] = useState<{ emailSent: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role: "SELLER" }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Registration failed");
      return;
    }
    // No router.refresh() here: re-rendering /register while signed in would
    // redirect away before the user reads the "check your inbox" message.
    setSent({ emailSent: Boolean(json.emailSent) });
  }

  /** Navigate and refresh server components so the navbar shows the session. */
  function go(href: string) {
    router.push(href);
    router.refresh();
  }

  // ---- "Check your inbox" state -------------------------------------------
  if (sent) {
    return (
      <AuthShell
        eyebrow="Almost there"
        title="Check your inbox"
        subtitle={
          sent.emailSent
            ? `We sent a verification link to ${email}. Click it to unlock publishing, buying and custom orders.`
            : "Your account was created, but we could not send the verification email right now. You can resend it from the reminder at the bottom of the page or from Settings."
        }
        footer={
          <>
            Nothing arrived? Check your spam folder, or use “Resend email” in
            the reminder at the bottom of the page.
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <button type="button" onClick={() => go("/")} className="btn-primary w-full !py-3">
            Browse the marketplace →
          </button>
          <button type="button" onClick={() => go("/dashboard")} className="btn-ghost w-full">
            Go to my dashboard
          </button>
        </div>
      </AuthShell>
    );
  }

  // ---- Sign-up form ------------------------------------------------------
  return (
    <AuthShell
      eyebrow="Join AgentBay"
      title="Create your account"
      subtitle="Sell AI-built apps, buy complete businesses, or order custom builds."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="link-neon">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="field-label">
          Name
          <input
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
          />
        </label>
        <label className="field-label">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
        </label>
        <label className="field-label">
          Password (min 8 chars)
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        </label>
        {error && <p className="alert-error">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-2 w-full !py-3">
          {loading ? "Creating account…" : "Create account →"}
        </button>
      </form>
    </AuthShell>
  );
}
