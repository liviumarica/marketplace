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
        // Bryntum needs three style sheets: structural CSS, exactly one theme
        // (the dark "svalbard" theme matches our cosmic UI) and FontAwesome
        // for its icons. Loaded once alongside the widget.
        await Promise.all([
          import("@bryntum/calendar-trial/calendar.css" as string),
          import("@bryntum/calendar-trial/svalbard-dark.css" as string),
          import("@bryntum/calendar-trial/fontawesome/css/fontawesome.css" as string),
          import("@bryntum/calendar-trial/fontawesome/css/solid.css" as string),
        ]).catch(() => {});
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
        {events.length === 0 && <li className="text-dim">No demos booked.</li>}
        {events.map((e) => (
          <li key={e.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white/80">
            <strong>{e.name}</strong> —{" "}
            {new Date(e.startDate).toLocaleString()}
          </li>
        ))}
      </ul>
    );
  }

  // `bryntum-host` lets globals.css blend the calendar into the glass panel;
  // data-lenis-prevent keeps wheel scrolling inside the calendar native.
  return <div ref={ref} className="bryntum-host w-full overflow-hidden rounded-xl" data-lenis-prevent />;
}
