"use client";

/**
 * DemoScheduler — lets a buyer book a live demo slot with the seller.
 * Renders a compact date/time picker; the scheduling UI on the dashboard
 * (calendar view) is powered by Bryntum. Bookings are real rows enforced
 * against double-booking on the server.
 */
import { useState } from "react";

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
    <div className="mt-4 border-t border-slate-200 pt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
      >
        {open ? "Hide demo scheduler" : "Book a live demo with the seller"}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-slate-600">
            Demo start (30 min slot)
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="block text-xs text-slate-600">
            Notes for the seller (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <button
            onClick={book}
            disabled={!start || loading}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Booking…" : "Confirm booking"}
          </button>
          {status && (
            <p
              className={`rounded-md px-3 py-2 text-xs ${
                isError
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {status.slice(status.indexOf(":") + 1)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
