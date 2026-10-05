"use client";

/**
 * VerifyEmailBanner — floating reminder shown to signed-in users whose email
 * is not confirmed yet. Offers a real "Resend email" action that calls
 * /api/auth/resend-verification (server-throttled to one email per minute).
 *
 * It floats at the bottom of the viewport instead of pushing page content,
 * so it never collides with the full-bleed hero or sticky elements. It can
 * be hidden for the current page view; it comes back on the next load
 * until the address is verified.
 */
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export function VerifyEmailBanner({ email }: { email: string }) {
  const [hidden, setHidden] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    setMessage(null);
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("error");
      setMessage(json.error ?? "Could not send the email");
      return;
    }
    // Verified in another tab meanwhile → a reload removes the banner.
    if (json.alreadyVerified) {
      window.location.reload();
      return;
    }
    setState("sent");
    setMessage(`New link sent to ${email}`);
  }

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          role="status"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.6 }}
          className="fixed inset-x-3 bottom-4 z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-amber-300/30 bg-[#16120a]/90 px-4 py-3 text-sm text-amber-50 shadow-[0_10px_40px_-10px_rgba(251,191,36,0.45)] backdrop-blur-xl"
        >
          <span aria-hidden className="text-amber-300">✉</span>
          <p className="min-w-0 flex-1">
            {message ?? (
              <>
                Confirm <strong className="font-semibold">{email}</strong> to publish, buy and
                take custom work.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={resend}
            disabled={state === "sending" || state === "sent"}
            className="rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-300/10 disabled:opacity-60"
          >
            {state === "sending" ? "Sending…" : state === "sent" ? "Sent ✓" : "Resend email"}
          </button>
          <button
            type="button"
            onClick={() => setHidden(true)}
            aria-label="Hide reminder"
            className="px-1 text-amber-100/60 hover:text-amber-50"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
