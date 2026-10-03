"use client";

/**
 * OfferForm — a developer submits an offer (price, days, pitch) on a
 * custom-build request.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export function OfferForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [priceUsd, setPriceUsd] = useState("");
  const [days, setDays] = useState("7");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const res = await fetch(`/api/requests/${requestId}/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        priceCents: Math.round(parseFloat(priceUsd) * 100),
        deliveryDays: parseInt(days, 10),
        message,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setStatus(`error:${json.error ?? "Could not send offer"}`);
      return;
    }
    setStatus("ok:Offer sent — the buyer has been notified.");
    router.refresh();
  }

  const isError = status?.startsWith("error:");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold">Make an offer</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Your price (USD)
            <input
              required
              type="number"
              min="10"
              step="1"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Delivery (days)
            <input
              required
              type="number"
              min="1"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Pitch — how you&apos;ll build it
          <textarea
            required
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. I'll build it with Next.js + AI scaffolding, deliver a deployed demo + repo…"
            className="rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
          />
        </label>
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
          disabled={loading}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send offer"}
        </button>
      </form>
    </section>
  );
}
