"use client";

/**
 * PriceBenchmark — calls the Channel3 product API (via our route) and shows
 * how the asking price compares to real software products on the market.
 * Renders nothing until loaded; shows a clear message if the sponsor key
 * isn't configured — never fabricates data.
 */
import { useEffect, useState } from "react";
import { formatUsd } from "@/lib/money";

interface Benchmark {
  query: string;
  sampleSize: number;
  minPrice: number | null;
  maxPrice: number | null;
  medianPrice: number | null;
  examples: { title: string; price: number | null; brand: string | null }[];
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

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Market price benchmark</h2>
      {state.kind === "loading" && (
        <p className="mt-2 text-sm text-slate-500">
          Comparing with real software products via Channel3…
        </p>
      )}
      {state.kind === "error" && (
        <p className="mt-2 text-sm text-slate-500">{state.msg}</p>
      )}
      {state.kind === "ok" && (
        <div className="mt-3">
          <p className="text-sm text-slate-600">
            Median price of {state.data.sampleSize} comparable products:{" "}
            <strong>
              {state.data.medianPrice
                ? `$${state.data.medianPrice.toFixed(2)}`
                : "n/a"}
            </strong>{" "}
            (range $
            {state.data.minPrice?.toFixed(2)} – $
            {state.data.maxPrice?.toFixed(2)})
          </p>
          {state.data.medianPrice != null && (
            <p className="mt-1 text-sm">
              This listing asks {formatUsd(askingCents)} —{" "}
              <strong
                className={
                  askingCents / 100 <= state.data.medianPrice
                    ? "text-emerald-700"
                    : "text-amber-700"
                }
              >
                {askingCents / 100 <= state.data.medianPrice
                  ? "below market median"
                  : "above market median"}
              </strong>
            </p>
          )}
          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            {state.data.examples.map((e, i) => (
              <li key={i}>
                {e.title}
                {e.brand ? ` (${e.brand})` : ""} —{" "}
                {e.price != null ? `$${e.price.toFixed(2)}` : "price n/a"}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">
            Live data via Channel3 product API
          </p>
        </div>
      )}
    </section>
  );
}
