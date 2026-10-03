"use client";

/**
 * Registration page — creates a real account via /api/auth/register.
 * New users get the SELLER role so they can both list apps and buy.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/fx/AuthShell";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role: "SELLER" }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Registration failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
        </label>
        <label className="field-label">
          Password (min 6 chars)
          <input
            type="password"
            required
            minLength={6}
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
          {loading ? "Creating account…" : "Create account →"}
        </button>
      </form>
    </AuthShell>
  );
}
