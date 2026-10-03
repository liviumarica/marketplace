"use client";

/**
 * EscrowActions — the buyer's decision buttons on a delivered custom order:
 * accept (capture the authorization, funds released to developer) or
 * dispute (void the authorization, funds returned to the buyer).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export function EscrowActions({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<"accept" | "dispute" | null>(null);

  async function accept() {
    setLoading("accept");
    setStatus(null);
    const res = await fetch(`/api/custom-orders/${orderId}/accept`, {
      method: "POST",
    });
    const json = await res.json();
    setLoading(null);
    if (!res.ok) {
      setStatus(`error:${json.error ?? "Acceptance failed"}`);
      return;
    }
    router.refresh();
  }

  async function dispute() {
    setLoading("dispute");
    setStatus(null);
    const res = await fetch(`/api/custom-orders/${orderId}/dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    setLoading(null);
    if (!res.ok) {
      setStatus(`error:${json.error ?? "Dispute failed"}`);
      return;
    }
    router.refresh();
  }

  const isError = status?.startsWith("error:");

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Review the delivery</h2>
      <p className="mt-1 text-sm text-slate-600">
        Accepting captures the escrowed PayPal funds — the developer gets
        paid. Disputing voids the authorization — your money comes back.
      </p>
      <div className="mt-4 flex gap-3">
        <button
          onClick={accept}
          disabled={loading !== null}
          className="flex-1 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading === "accept" ? "Releasing…" : "Accept & release funds"}
        </button>
        <button
          onClick={() => setShowDispute((v) => !v)}
          disabled={loading !== null}
          className="rounded-md border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Dispute
        </button>
      </div>
      {showDispute && (
        <div className="mt-3 space-y-2">
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you disputing? (min 5 chars)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
          />
          <button
            onClick={dispute}
            disabled={reason.length < 5 || loading !== null}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading === "dispute" ? "Voiding…" : "Confirm dispute — refund me"}
          </button>
        </div>
      )}
      {status && (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {status.slice(status.indexOf(":") + 1)}
        </p>
      )}
    </section>
  );
}
