"use client";

/**
 * Sell-your-app page — the AI listing autopilot.
 *
 * Seller pastes a GitHub repo or demo URL -> "Generate with AI" fetches the
 * real page content and fills the form -> "Suggest price" prices it ->
 * submit creates the listing. PayPal payout details are collected once and
 * stored on the seller profile.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

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

  /** Save PayPal payout details then create the listing. */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("submit");
    setStatus(null);

    // Persist the seller's PayPal identity so payouts can reach them.
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paypalEmail, paypalMerchantId }),
    });

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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Sell your AI-built app</h1>
      <p className="mt-1 text-sm text-slate-600">
        You are selling the complete business: source code, brand, and docs.
        The platform keeps a 10% commission on the sale.
      </p>

      {/* AI autopilot */}
      <section className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/50 p-5">
        <h2 className="font-semibold text-indigo-900">AI listing autopilot</h2>
        <p className="mt-1 text-sm text-indigo-800">
          Paste a GitHub repo or live demo URL — the AI reads it and writes
          your listing.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://github.com/you/your-app or https://your-demo.com"
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={autofill}
            disabled={!sourceUrl || busy !== null}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy === "ai" ? "Reading…" : "Generate with AI"}
          </button>
        </div>
      </section>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Title *
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Category *
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Tagline
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Description *
          <textarea
            required
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Tech stack (comma-separated)
            <input
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="Next.js, Postgres, OpenAI"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Features (one per line)
            <textarea
              rows={3}
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Demo URL (app will be AI-verified)
            <input
              type="url"
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              placeholder="https://your-app-demo.com"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Repo URL (transferred to buyer)
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/you/your-app"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </label>
        </div>

        {/* Price with AI suggestion */}
        <div className="flex items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Asking price (USD) *
            <input
              required
              type="number"
              min="1"
              step="0.01"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={suggestPrice}
            disabled={!title || busy !== null}
            className="rounded-md border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            {busy === "price" ? "Pricing…" : "Suggest with AI"}
          </button>
        </div>
        {priceHint && (
          <p className="rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            {priceHint}
          </p>
        )}

        {/* PayPal payout details */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Your PayPal payout details (sandbox)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Where your 90% share goes — use your sandbox business account.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              PayPal email *
              <input
                required
                type="email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                placeholder="seller@business.example.com"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Merchant ID (for direct split)
              <input
                value={paypalMerchantId}
                onChange={(e) => setPaypalMerchantId(e.target.value)}
                placeholder="ABC123DEF456"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
              />
            </label>
          </div>
        </section>

        {status && (
          <p
            className={`rounded-md px-3 py-2 text-sm ${
              isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {status.slice(status.indexOf(":") + 1)}
          </p>
        )}

        <button
          type="submit"
          disabled={busy !== null}
          className="w-full rounded-md bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy === "submit" ? "Publishing…" : "Publish listing"}
        </button>
      </form>
    </div>
  );
}
