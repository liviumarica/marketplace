"use client";

/**
 * /forgot-password — request a password-reset email.
 * The API answers identically whether or not the account exists, so the UI
 * always shows the same confirmation (no account enumeration).
 */
import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/fx/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong");
      return;
    }
    setDone(true);
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title={done ? "Check your inbox" : "Forgot your password?"}
      subtitle={
        done
          ? `If an account exists for ${email}, we've sent a link to choose a new password. It's valid for 1 hour.`
          : "Enter the email you signed up with and we'll send you a link to choose a new password."
      }
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="link-neon">
            Back to log in
          </Link>
        </>
      }
    >
      {done ? (
        <p className="alert-info text-sm">
          Nothing after a few minutes? Check your spam folder, or{" "}
          <button type="button" onClick={() => setDone(false)} className="link-neon">
            try again
          </button>
          .
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
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
          {error && <p className="alert-error">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary mt-2 w-full !py-3">
            {loading ? "Sending…" : "Send reset link →"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
