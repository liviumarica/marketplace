"use client";

/**
 * OfferForm — a developer submits an offer (price, days, pitch) on a
 * custom-build request.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { blockNonDecimalKeys, blockNonIntegerKeys, parseDays, parseUsdToCents } from "@/lib/number-input";

export function OfferForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [priceUsd, setPriceUsd] = useState("");
  const [days, setDays] = useState("7");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    // Reject "e1", negatives, decimals in day counts… before calling the API.
    const price = parseUsdToCents(priceUsd, { minUsd: 10 });
    const delivery = parseDays(days);
    if ("error" in price || "error" in delivery) {
      setStatus(`error:${"error" in price ? price.error : (delivery as { error: string }).error}`);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/requests/${requestId}/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        priceCents: price.cents,
        deliveryDays: delivery.days,
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
    <section className="neon-border rounded-2xl p-7">
      <p className="eyebrow">For developers</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Make an offer</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            Your price (USD)
            <input
              required
              type="number"
              inputMode="decimal"
              min="10"
              step="1"
              value={priceUsd}
              onKeyDown={blockNonDecimalKeys}
              onChange={(e) => setPriceUsd(e.target.value)}
              className="field"
            />
          </label>
          <label className="field-label">
            Delivery (days)
            <input
              required
              type="number"
              inputMode="numeric"
              min="1"
              max="365"
              value={days}
              onKeyDown={blockNonIntegerKeys}
              onChange={(e) => setDays(e.target.value)}
              className="field"
            />
          </label>
        </div>
        <label className="field-label">
          Pitch — how you&apos;ll build it
          <textarea
            required
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. I'll build it with Next.js + AI scaffolding, deliver a deployed demo + repo…"
            className="field"
          />
        </label>
        {status && (
          <p className={isError ? "alert-error" : "alert-success"}>
            {status.slice(status.indexOf(":") + 1)}
          </p>
        )}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Sending…" : "Send offer"}
        </button>
      </form>
    </section>
  );
}
