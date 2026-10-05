"use client";

/**
 * Choose-a-new-password form. On success every session is signed out
 * server-side and we send the user to /login with a confirmation notice.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/fx/AuthShell";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Could not reset the password");
      return;
    }
    // The session cookie was cleared server-side: navigate, then refresh so
    // the navbar re-renders from the server in the signed-out state.
    router.push("/login?reset=success");
    router.refresh();
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Choose a new password"
      subtitle="Pick something you don't use elsewhere. You'll be signed out on all devices."
      footer={
        <>
          Link expired?{" "}
          <Link href="/forgot-password" className="link-neon">
            Request a new one
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="field-label">
          New password (min 8 chars)
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
        <label className="field-label">
          Confirm new password
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="field"
          />
        </label>
        {error && <p className="alert-error">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-2 w-full !py-3">
          {loading ? "Saving…" : "Save new password →"}
        </button>
      </form>
    </AuthShell>
  );
}
