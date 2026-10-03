"use client";

/**
 * DeliverForm — developer submits the finished app (repo/demo URL + notes),
 * which starts the buyer review window on the escrow.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeliverForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const res = await fetch(`/api/custom-orders/${orderId}/deliver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryUrl: url, notes: notes || undefined }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setStatus(`error:${json.error ?? "Delivery failed"}`);
      return;
    }
    router.refresh();
  }

  const isError = status?.startsWith("error:");

  return (
    <section className="neon-border mt-6 rounded-2xl p-7">
      <p className="eyebrow">Developer action</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Deliver the app</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <label className="field-label">
          Delivery URL (repo, deployed demo, or archive link)
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="field"
          />
        </label>
        <label className="field-label">
          Notes for the buyer (optional)
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="field"
          />
        </label>
        {status && (
          <p className={isError ? "alert-error" : "alert-success"}>
            {status.slice(status.indexOf(":") + 1)}
          </p>
        )}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Delivering…" : "Deliver for review"}
        </button>
      </form>
    </section>
  );
}
