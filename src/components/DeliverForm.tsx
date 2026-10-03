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
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Deliver the app</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <label className="flex flex-col gap-1 text-sm">
          Delivery URL (repo, deployed demo, or archive link)
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Notes for the buyer (optional)
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
          {loading ? "Delivering…" : "Deliver for review"}
        </button>
      </form>
    </section>
  );
}
