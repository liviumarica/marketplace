"use client";

/**
 * Login form — posts credentials to /api/auth/login.
 * On success the server sets an httpOnly session cookie and we redirect.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/fx/AuthShell";

interface LoginFormProps {
  /** Optional success message shown above the form (e.g. after a reset). */
  notice: string | null;
}

export function LoginForm({ notice }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Login failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Log in to AgentBay"
      subtitle="Buy, sell and commission AI-built software businesses."
      footer={
        <>
          No account?{" "}
          <Link href="/register" className="link-neon">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {notice && <p className="alert-success">{notice}</p>}
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
          <span className="flex items-center justify-between">
            Password
            {/* Entry point of the password-recovery flow. */}
            <Link href="/forgot-password" className="link-neon text-xs font-normal">
              Forgot password?
            </Link>
          </span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        </label>
        {error && <p className="alert-error">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary mt-2 w-full !py-3">
          {loading ? "Logging in…" : "Log in →"}
        </button>
      </form>
    </AuthShell>
  );
}
