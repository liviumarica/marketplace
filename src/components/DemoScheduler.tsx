"use client";

/**
 * DemoScheduler — lets a buyer book a live demo slot with the seller.
 * Renders a compact date/time picker; the scheduling UI on the dashboard
 * (calendar view) is powered by Bryntum. Bookings are real rows enforced
 * against double-booking on the server.
 *
 * The picker expands/collapses with a smooth height animation.
 */
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export function DemoScheduler({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function book() {
    if (!start) return;
    setLoading(true);
    setStatus(null);
    // Book a 30-minute demo slot starting at the chosen time.
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        notes: notes || undefined,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setStatus(`error:${json.error ?? "Booking failed"}`);
      return;
    }
    setStatus("ok:Demo booked — the seller has been notified.");
  }

  const isError = status?.startsWith("error:");

  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <button onClick={() => setOpen((v) => !v)} className="btn-ghost w-full">
        {open ? "Hide demo scheduler" : "Book a live demo with the seller"}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              <label className="field-label">
                Demo start (30 min slot)
                <input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="field"
                />
              </label>
              <label className="field-label">
                Notes for the seller (optional)
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="field"
                />
              </label>
              <button onClick={book} disabled={!start || loading} className="btn-primary w-full">
                {loading ? "Booking…" : "Confirm booking"}
              </button>
              {status && (
                <p className={`text-xs ${isError ? "alert-error" : "alert-success"}`}>
                  {status.slice(status.indexOf(":") + 1)}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
