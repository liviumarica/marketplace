"use client";

/**
 * BookingsCalendar — Bryntum Calendar showing demo bookings for the user
 * (as buyer or seller). Loaded dynamically client-side because Bryntum is a
 * browser-only widget; events come from real DB rows.
 */
import { useEffect, useRef, useState } from "react";

export interface BookingEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  notes?: string | null;
}

export function BookingsCalendar({ events }: { events: BookingEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let destroyed = false;
    let calendar: { destroy?: () => void } | undefined;

    async function mount() {
      try {
        // Bryntum is browser-only — dynamic import keeps SSR safe.
        const mod = await import("@bryntum/calendar-trial");
        // Theme CSS — loaded once alongside the widget.
        await import("@bryntum/calendar-trial/calendar.css" as string).catch(
          () => {},
        );
        if (destroyed || !ref.current) return;
        calendar = new mod.Calendar({
          appendTo: ref.current,
          height: 480,
          modes: { agenda: null }, // keep the calendar modes simple
          events: events.map((e) => ({
            id: e.id,
            name: e.name,
            startDate: e.startDate,
            endDate: e.endDate,
          })),
        });
      } catch (err) {
        console.warn("Bryntum calendar failed to load:", err);
        setFailed(true);
      }
    }
    void mount();
    return () => {
      destroyed = true;
      calendar?.destroy?.();
    };
  }, [events]);

  if (failed) {
    // Honest fallback if the Bryntum bundle can't load — still show real data.
    return (
      <ul className="space-y-2 text-sm">
        {events.length === 0 && <li className="text-slate-500">No demos booked.</li>}
        {events.map((e) => (
          <li key={e.id} className="rounded-md border border-slate-200 p-3">
            <strong>{e.name}</strong> —{" "}
            {new Date(e.startDate).toLocaleString()}
          </li>
        ))}
      </ul>
    );
  }

  return <div ref={ref} className="w-full" />;
}
