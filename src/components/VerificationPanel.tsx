"use client";

/**
 * VerificationPanel — shown only to the listing owner. Explains in plain
 * words what "AI verification" is, shows the current state, and offers a
 * real "Run / Retry AI verification" button (POST /api/listings/:id/verify,
 * which starts the KERNEL agent in the background).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toneClass, verificationLabel } from "@/lib/listing-status";

interface VerificationPanelProps {
  listingId: string;
  status: string;
  score: number | null;
  /** Verification needs a live demo URL to open. */
  hasDemoUrl: boolean;
  /** False when the platform has no KERNEL key configured. */
  enabled: boolean;
}

export function VerificationPanel({ listingId, status, score, hasDemoUrl, enabled }: VerificationPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = verificationLabel(status, score);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/listings/${listingId}/verify`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not start verification");
      return;
    }
    // Re-render the server page: status flips to "Verifying…".
    router.refresh();
  }

  // Why the button is (not) available, in plain words.
  const reason = !enabled
    ? "AI verification isn't switched on for this marketplace yet."
    : !hasDemoUrl
      ? "This listing has no live demo URL, so there is nothing for the agent to test."
      : null;
  const canRun = !reason && status !== "RUNNING" && status !== "PASSED";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-white">AI verification</span>
        <span className={`chip ${toneClass(label.tone)}`}>{label.label}</span>
      </div>
      <p className="text-muted mt-2 text-xs leading-relaxed">{label.hint}</p>
      {reason && status !== "PASSED" && <p className="text-dim mt-2 text-xs">{reason}</p>}
      {canRun && (
        <button type="button" onClick={start} disabled={busy} className="btn-ghost mt-3 w-full !py-2 !text-sm">
          {busy ? "Starting…" : status === "FAILED" ? "Retry AI verification" : "Run AI verification"}
        </button>
      )}
      {error && <p className="alert-error mt-2 text-xs">{error}</p>}
    </div>
  );
}
