"use client";

/**
 * Sell-your-app page — the AI listing autopilot.
 *
 * Seller pastes a GitHub repo or demo URL -> "Generate with AI" fetches the
 * real page content and fills the form -> "Suggest price" prices it ->
 * submit creates the listing. PayPal payout details are OPTIONAL here (less
 * friction for new sellers): if filled they are stored on the seller
 * profile, otherwise the seller adds them later in Settings — checkout for
 * their listings is enabled as soon as they do.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageTransition } from "@/components/fx/PageTransition";
import { PageHeader } from "@/components/fx/PageHeader";
import { Reveal } from "@/components/fx/Reveal";

const CATEGORIES = [
  "Productivity",
  "Finance",
  "Marketing",
  "Developer Tools",
  "E-Commerce",
  "Analytics",
  "HR & Recruiting",
  "Customer Support",
  "Education",
  "Other",
];

interface AutofillResult {
  title: string;
  tagline: string;
  description: string;
  category: string;
  techStack: string[];
  features: string[];
}

export default function NewListingPage() {
  const router = useRouter();

  // Source URL driving the AI autopilot.
  const [sourceUrl, setSourceUrl] = useState("");
  // Form fields (filled by AI or manually).
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Productivity");
  const [techStack, setTechStack] = useState("");
  const [features, setFeatures] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  // Seller PayPal payout identity.
  const [paypalEmail, setPaypalEmail] = useState("");
  const [paypalMerchantId, setPaypalMerchantId] = useState("");
  // True once the seller already has payout details saved on their profile.
  const [hasSavedPayout, setHasSavedPayout] = useState(false);

  // Pre-fill payout details already stored on the profile so returning
  // sellers don't retype them (and so we never overwrite them with blanks).
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(({ user }) => {
        if (!user) return;
        setPaypalEmail(user.paypalEmail ?? "");
        setPaypalMerchantId(user.paypalMerchantId ?? "");
        setHasSavedPayout(Boolean(user.paypalEmail || user.paypalMerchantId));
      })
      .catch(() => {
        /* non-blocking: the fields simply stay empty */
      });
  }, []);

  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<"ai" | "price" | "submit" | null>(null);
  const [priceHint, setPriceHint] = useState<string | null>(null);

  /** Ask the AI to turn the URL into listing fields. */
  async function autofill() {
    if (!sourceUrl) return;
    setBusy("ai");
    setStatus(null);
    const res = await fetch("/api/ai/listing-autofill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: sourceUrl }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setStatus(`error:${json.error ?? "AI autofill failed"}`);
      return;
    }
    const d = json as AutofillResult;
    setTitle(d.title);
    setTagline(d.tagline);
    setDescription(d.description);
    setCategory(d.category);
    setTechStack(d.techStack.join(", "));
    setFeatures(d.features.join("\n"));
    // A repo URL doubles as the repo to transfer; a web URL as the demo.
    if (sourceUrl.includes("github.com")) setRepoUrl(sourceUrl);
    else setDemoUrl(sourceUrl);
  }

  /** Ask the AI for a fair acquisition price. */
  async function suggestPrice() {
    setBusy("price");
    setStatus(null);
    const res = await fetch("/api/ai/price-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        category,
        techStack: techStack.split(",").map((s) => s.trim()).filter(Boolean),
        features: features.split("\n").map((s) => s.trim()).filter(Boolean),
      }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setStatus(`error:${json.error ?? "Price suggestion failed"}`);
      return;
    }
    setPriceUsd((json.suggestedCents / 100).toFixed(2));
    setPriceHint(
      `Suggested range $${(json.minCents / 100).toFixed(0)}–$${(json.maxCents / 100).toFixed(0)}. ${json.rationale}`,
    );
  }

  /** Save PayPal payout details (if provided) then create the listing. */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("submit");
    setStatus(null);

    // Persist the seller's PayPal identity only when something was entered —
    // blank fields are skipped so saved details are never wiped.
    const payout = {
      ...(paypalEmail.trim() ? { paypalEmail: paypalEmail.trim() } : {}),
      ...(paypalMerchantId.trim() ? { paypalMerchantId: paypalMerchantId.trim() } : {}),
    };
    if (Object.keys(payout).length > 0) {
      const profileRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payout),
      });
      if (!profileRes.ok) {
        const pj = await profileRes.json().catch(() => ({}));
        setBusy(null);
        setStatus(`error:${pj.error ?? "Could not save payout details"}`);
        return;
      }
    }

    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        tagline,
        description,
        category,
        techStack: techStack.split(",").map((s) => s.trim()).filter(Boolean),
        features: features.split("\n").map((s) => s.trim()).filter(Boolean),
        priceCents: Math.round(parseFloat(priceUsd) * 100),
        demoUrl,
        repoUrl,
      }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setStatus(`error:${json.error ?? "Could not create listing"}`);
      return;
    }
    router.push(`/listings/${json.listingId}`);
  }

  const isError = status?.startsWith("error:");

  return (
    <PageTransition>
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        eyebrow="Sell"
        title="Sell your AI-built app"
        subtitle="You are selling the complete business: source code, brand, and docs. The platform keeps a 10% commission on the sale."
      />

      {/* AI autopilot — the glowing "magic" panel */}
      <Reveal delay={0.2}>
        <section className="neon-border relative mt-10 overflow-hidden rounded-3xl p-7 shadow-[0_0_80px_-25px_rgba(139,92,246,0.9)]">
          {/* Shimmer sweep while the AI is reading the URL. */}
          {busy === "ai" && (
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="h-full w-1/2 animate-[marquee_1.4s_linear_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
          )}
          <p className="eyebrow">✦ AI listing autopilot</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Paste a link. <span className="text-gradient">Get a listing.</span>
          </h2>
          <p className="text-muted mt-2 text-sm">
            Paste a GitHub repo or live demo URL — the AI reads it and writes
            your listing.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://github.com/you/your-app or https://your-demo.com"
              className="field flex-1"
            />
            <button
              type="button"
              onClick={autofill}
              disabled={!sourceUrl || busy !== null}
              className="btn-primary"
            >
              {busy === "ai" ? "Reading…" : "Generate with AI"}
            </button>
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.3}>
      <form onSubmit={submit} className="glass mt-8 space-y-5 rounded-3xl p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            Title *
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field"
            />
          </label>
          <label className="field-label">
            Category *
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="field"
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="field-label">
          Tagline
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="field"
          />
        </label>

        <label className="field-label">
          Description *
          <textarea
            required
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="field"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            Tech stack (comma-separated)
            <input
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="Next.js, Postgres, OpenAI"
              className="field"
            />
          </label>
          <label className="field-label">
            Features (one per line)
            <textarea
              rows={3}
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              className="field"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            Demo URL (app will be AI-verified)
            <input
              type="url"
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              placeholder="https://your-app-demo.com"
              className="field"
            />
          </label>
          <label className="field-label">
            Repo URL (transferred to buyer)
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/you/your-app"
              className="field"
            />
          </label>
        </div>

        {/* Price with AI suggestion */}
        <div className="flex items-end gap-3">
          <label className="field-label flex-1">
            Asking price (USD) *
            <input
              required
              type="number"
              min="1"
              step="0.01"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              className="field"
            />
          </label>
          <button
            type="button"
            onClick={suggestPrice}
            disabled={!title || busy !== null}
            className="btn-ghost"
          >
            {busy === "price" ? "Pricing…" : "✦ Suggest with AI"}
          </button>
        </div>
        {priceHint && <p className="alert-info text-xs">{priceHint}</p>}

        {/* PayPal payout details — optional at publish time */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-white">PayPal payout details</h2>
            <span className={`chip ${hasSavedPayout ? "chip-green" : ""}`}>
              {hasSavedPayout ? "✓ Saved on your profile" : "Optional — add now or later"}
            </span>
          </div>
          <p className="text-dim mt-1 text-xs">
            Where your 90% share goes. You can publish without it and add it
            later in Settings — buyers can check out once it&apos;s set.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              PayPal email
              <input
                type="email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                placeholder="seller@business.example.com"
                className="field"
              />
            </label>
            <label className="field-label">
              Merchant ID (for direct split)
              <input
                value={paypalMerchantId}
                onChange={(e) => setPaypalMerchantId(e.target.value)}
                placeholder="ABC123DEF456"
                className="field"
              />
            </label>
          </div>
        </section>

        {status && (
          <p className={isError ? "alert-error" : "alert-success"}>
            {status.slice(status.indexOf(":") + 1)}
          </p>
        )}

        <button type="submit" disabled={busy !== null} className="btn-primary w-full !py-3.5">
          {busy === "submit" ? "Publishing…" : "Publish listing →"}
        </button>
      </form>
      </Reveal>
    </div>
    </PageTransition>
  );
}
