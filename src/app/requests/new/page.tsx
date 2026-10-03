"use client";

/**
 * Post-a-request page — buyer describes the app they need.
 * "Refine with AI" turns the rough brief into a structured spec with a
 * suggested budget, which buyers can use as-is or edit.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewRequestPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [refinedBrief, setRefinedBrief] = useState("");
  const [budgetUsd, setBudgetUsd] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("14");
  const [category, setCategory] = useState("Productivity");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<"ai" | "submit" | null>(null);

  /** Ask the AI to structure the rough brief into a developer-ready spec. */
  async function refine() {
    setBusy("ai");
    setStatus(null);
    const res = await fetch("/api/ai/refine-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, brief }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setStatus(`error:${json.error ?? "AI refine failed"}`);
      return;
    }
    setRefinedBrief(json.refinedBrief);
    setBudgetUsd((json.suggestedBudgetCents / 100).toFixed(0));
    setDeadlineDays(String(json.estimatedDays));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("submit");
    setStatus(null);
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        brief,
        refinedBrief: refinedBrief || undefined,
        budgetCents: Math.round(parseFloat(budgetUsd) * 100),
        deadlineDays: parseInt(deadlineDays, 10),
        category,
      }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setStatus(`error:${json.error ?? "Could not create request"}`);
      return;
    }
    router.push(`/requests/${json.requestId}`);
  }

  const isError = status?.startsWith("error:");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Post a custom build request</h1>
      <p className="mt-1 text-sm text-slate-600">
        Describe the app you need. Developers will send offers; your payment is
        held in PayPal escrow and only released when you accept the delivery.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="flex flex-col gap-1 text-sm">
          Title *
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Booking app for my barbershop"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <div>
          <label className="flex flex-col gap-1 text-sm">
            Describe what you need *
            <textarea
              required
              rows={5}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="What should the app do? Who will use it? Any must-have features?"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={refine}
            disabled={!title || brief.length < 10 || busy !== null}
            className="mt-2 rounded-md border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            {busy === "ai" ? "Refining…" : "Refine brief with AI"}
          </button>
        </div>

        {refinedBrief && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
            <h2 className="text-sm font-semibold text-indigo-900">
              AI-refined spec (sent to developers)
            </h2>
            <textarea
              rows={8}
              value={refinedBrief}
              onChange={(e) => setRefinedBrief(e.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Budget (USD) *
            <input
              required
              type="number"
              min="10"
              step="1"
              value={budgetUsd}
              onChange={(e) => setBudgetUsd(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Deadline (days) *
            <input
              required
              type="number"
              min="1"
              max="365"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
            >
              {[
                "Productivity",
                "Finance",
                "Marketing",
                "Developer Tools",
                "E-Commerce",
                "Analytics",
                "Education",
                "Other",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

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
          {busy === "submit" ? "Posting…" : "Post request"}
        </button>
      </form>
    </div>
  );
}
