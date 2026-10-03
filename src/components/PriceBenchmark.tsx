"use client";

/**
 * PriceBenchmark — calls the Channel3 product API (via our route) and shows
 * how the asking price compares to real software products on the market.
 * Renders nothing until loaded; shows a clear message if the sponsor key
 * isn't configured — never fabricates data.
 *
 * Visual: a glass panel with a min→max range bar where the median and the
 * asking price are plotted as glowing markers (only when real data exists).
 */
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { formatUsd } from "@/lib/money";

interface Benchmark {
  query: string;
  sampleSize: number;
  minPrice: number | null;
  maxPrice: number | null;
  medianPrice: number | null;
  examples: { title: string; price: number | null; brand: string | null }[];
}

/** Position (0-100%) of `v` within [min, max], clamped. */
function pos(v: number, min: number, max: number): number {
  if (max <= min) return 50;
  return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
}

export function PriceBenchmark({
  title,
  category,
  askingCents,
}: {
  title: string;
  category: string;
  askingCents: number;
}) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "off" }
    | { kind: "error"; msg: string }
    | { kind: "ok"; data: Benchmark }
  >({ kind: "loading" });

  useEffect(() => {
    const q = encodeURIComponent(`${category} software ${title}`.slice(0, 80));
    fetch(`/api/channel3/benchmark?q=${q}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.configured) setState({ kind: "off" });
        else if (!json.benchmark || json.benchmark.sampleSize === 0)
          setState({ kind: "error", msg: "No comparable products found" });
        else setState({ kind: "ok", data: json.benchmark });
      })
      .catch(() => setState({ kind: "error", msg: "Benchmark request failed" }));
  }, [title, category]);

  if (state.kind === "off") return null; // sponsor key not configured — hide cleanly

  const asking = askingCents / 100;

  return (
    <section className="glass rounded-2xl p-7">
      <p className="eyebrow">Market price benchmark</p>
      {state.kind === "loading" && (
        <p className="text-dim mt-3 flex items-center gap-2 text-sm">
          <span className="h-3 w-3 animate-spin rounded-full border border-cyan-300 border-t-transparent" />
          Comparing with real software products via Channel3…
        </p>
      )}
      {state.kind === "error" && <p className="text-dim mt-3 text-sm">{state.msg}</p>}
      {state.kind === "ok" && (
        <div className="mt-4">
          <p className="text-muted text-sm">
            Median price of {state.data.sampleSize} comparable products:{" "}
            <strong className="font-mono text-white">
              {state.data.medianPrice ? `$${state.data.medianPrice.toFixed(2)}` : "n/a"}
            </strong>{" "}
            (range ${state.data.minPrice?.toFixed(2)} – ${state.data.maxPrice?.toFixed(2)})
          </p>

          {/* Range bar with median + asking-price markers. */}
          {state.data.minPrice != null &&
            state.data.maxPrice != null &&
            state.data.medianPrice != null && (
              <div className="relative mt-8 h-2 rounded-full bg-gradient-to-r from-emerald-400/40 via-cyan-400/40 to-fuchsia-400/40">
                {[
                  { v: state.data.medianPrice, label: "median", color: "bg-white" },
                  { v: asking, label: "this app", color: "bg-cyan-300" },
                ].map((m) => (
                  <motion.div
                    key={m.label}
                    initial={{ left: "0%", opacity: 0 }}
                    whileInView={{
                      left: `${pos(m.v, state.data.minPrice!, Math.max(state.data.maxPrice!, asking))}%`,
                      opacity: 1,
                    }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  >
                    <div className={`h-4 w-4 rounded-full ${m.color} shadow-[0_0_14px_rgba(34,211,238,0.9)]`} />
                    <span className="text-dim absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-widest">
                      {m.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}

          {state.data.medianPrice != null && (
            <p className="mt-10 text-sm text-white/80">
              This listing asks <span className="font-mono">{formatUsd(askingCents)}</span> —{" "}
              <strong
                className={asking <= state.data.medianPrice ? "text-emerald-300" : "text-amber-300"}
              >
                {asking <= state.data.medianPrice ? "below market median" : "above market median"}
              </strong>
            </p>
          )}
          <ul className="text-dim mt-4 space-y-1 text-xs">
            {state.data.examples.map((e, i) => (
              <li key={i}>
                {e.title}
                {e.brand ? ` (${e.brand})` : ""} —{" "}
                {e.price != null ? `$${e.price.toFixed(2)}` : "price n/a"}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] uppercase tracking-widest text-white/30">
            Live data via Channel3 product API
          </p>
        </div>
      )}
    </section>
  );
}
