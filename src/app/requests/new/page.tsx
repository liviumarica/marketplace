"use client";

/**
 * Post-a-request page — buyer describes the app they need.
 * "Refine with AI" turns the rough brief into a structured spec with a
 * suggested budget, which buyers can use as-is or edit.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageTransition } from "@/components/fx/PageTransition";
import { PageHeader } from "@/components/fx/PageHeader";
import { Reveal } from "@/components/fx/Reveal";

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
    <PageTransition>
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        eyebrow="Custom build"
        title="Post a custom build request"
        subtitle="Describe the app you need. Developers will send offers; your payment is held in PayPal escrow and only released when you accept the delivery."
      />

      <Reveal delay={0.25}>
      <form onSubmit={submit} className="glass mt-10 space-y-5 rounded-3xl p-7">
        <label className="field-label">
          Title *
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Booking app for my barbershop"
            className="field"
          />
        </label>

        <div>
          <label className="field-label">
            Describe what you need *
            <textarea
              required
              rows={5}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="What should the app do? Who will use it? Any must-have features?"
              className="field"
            />
          </label>
          <button
            type="button"
            onClick={refine}
            disabled={!title || brief.length < 10 || busy !== null}
            className="btn-ghost mt-3"
          >
            {busy === "ai" ? (
              <>
                {/* Animated "thinking" dots while the AI refines. */}
                <span className="flex gap-1">
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-cyan-300 [animation-delay:0.15s]" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-cyan-300 [animation-delay:0.3s]" />
                </span>
                Refining…
              </>
            ) : (
              "✦ Refine brief with AI"
            )}
          </button>
        </div>

        {refinedBrief && (
          <div className="neon-border space-y-3 rounded-2xl p-5">
            <h2 className="eyebrow">AI-refined spec (sent to developers)</h2>
            <textarea
              rows={8}
              value={refinedBrief}
              onChange={(e) => setRefinedBrief(e.target.value)}
              className="field"
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="field-label">
            Budget (USD) *
            <input
              required
              type="number"
              min="10"
              step="1"
              value={budgetUsd}
              onChange={(e) => setBudgetUsd(e.target.value)}
              className="field"
            />
          </label>
          <label className="field-label">
            Deadline (days) *
            <input
              required
              type="number"
              min="1"
              max="365"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
              className="field"
            />
          </label>
          <label className="field-label">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="field"
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
          <p className={isError ? "alert-error" : "alert-success"}>
            {status.slice(status.indexOf(":") + 1)}
          </p>
        )}

        <button type="submit" disabled={busy !== null} className="btn-primary w-full !py-3.5">
          {busy === "submit" ? "Posting…" : "Post request →"}
        </button>
      </form>
      </Reveal>
    </div>
    </PageTransition>
  );
}
