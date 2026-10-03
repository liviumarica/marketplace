"use client";

/**
 * EscrowActions — the buyer's decision buttons on a delivered custom order:
 * accept (capture the authorization, funds released to developer) or
 * dispute (void the authorization, funds returned to the buyer).
 *
 * The dispute form expands/collapses with a height animation.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

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
    <section className="neon-border mt-6 rounded-2xl p-7">
      <p className="eyebrow">Buyer decision</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Review the delivery</h2>
      <p className="text-muted mt-2 text-sm">
        Accepting captures the escrowed PayPal funds — the developer gets
        paid. Disputing voids the authorization — your money comes back.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={accept}
          disabled={loading !== null}
          className="btn-ghost btn-success flex-1"
        >
          {loading === "accept" ? "Releasing…" : "✓ Accept & release funds"}
        </button>
        <button
          onClick={() => setShowDispute((v) => !v)}
          disabled={loading !== null}
          className="btn-ghost btn-danger"
        >
          Dispute
        </button>
      </div>
      <AnimatePresence initial={false}>
        {showDispute && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you disputing? (min 5 chars)"
                className="field"
              />
              <button
                onClick={dispute}
                disabled={reason.length < 5 || loading !== null}
                className="btn-ghost btn-danger"
              >
                {loading === "dispute" ? "Voiding…" : "Confirm dispute — refund me"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {status && (
        <p className={`mt-4 ${isError ? "alert-error" : "alert-success"}`}>
          {status.slice(status.indexOf(":") + 1)}
        </p>
      )}
    </section>
  );
}
