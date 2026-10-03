"use client";

/**
 * Login page — posts credentials to /api/auth/login.
 * On success the server sets an httpOnly session cookie and we redirect.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/fx/AuthShell";

export default function LoginPage() {
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
      subtitle="Demo accounts are seeded — see README for credentials."
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
        <label className="field-label">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
        </label>
        <label className="field-label">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        </label>
        {error && (
          <p className="alert-error">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className="btn-primary mt-2 w-full !py-3">
          {loading ? "Logging in…" : "Log in →"}
        </button>
      </form>
    </AuthShell>
  );
}
