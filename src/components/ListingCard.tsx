/**
 * Card shown in the browse grid for one listed SaaS business.
 *
 * Visuals:
 *   - SpotlightCard: 3D tilt + cursor-following glow (client effect).
 *   - A generative "cover" whose aurora colours derive from the category
 *     (deterministic — no fake screenshots).
 *   - Neon AI-verified badge with the real quality score.
 *   - The title is a named <ViewTransition>, so it morphs into the heading
 *     of the listing detail page on navigation.
 */
import Link from "next/link";
import { ViewTransition } from "react";
import { formatUsd } from "@/lib/money";
import { hueFor } from "@/lib/hue";
import { SpotlightCard } from "@/components/fx/SpotlightCard";

export interface ListingCardData {
  id: string;
  title: string;
  tagline: string | null;
  category: string;
  priceCents: number;
  verificationStatus: string;
  aiQualityScore: number | null;
  sellerName: string;
}

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const hue = hueFor(listing.category);
  const verified = listing.verificationStatus === "PASSED";

  return (
    <Link href={`/listings/${listing.id}`} className="block h-full">
      {/* Glow colour matches the category hue of the cover. */}
      <SpotlightCard className="h-full" glow={hslToRgbTriplet(hue)}>
        <div className="flex h-full flex-col">
          {/* Generative cover: category-tinted aurora + grid + monogram. */}
          <div className="relative h-36 overflow-hidden border-b border-white/10">
            <div
              className="absolute inset-0 transition-transform duration-700 group-hover:scale-110"
              style={{
                background: `radial-gradient(circle at 20% 20%, hsla(${hue},90%,62%,0.75), transparent 55%),
                             radial-gradient(circle at 85% 70%, hsla(${(hue + 70) % 360},90%,55%,0.6), transparent 55%),
                             linear-gradient(135deg, #0b0c1d, #141532)`,
              }}
            />
            <div className="dot-bg absolute inset-0 opacity-60" />
            {/* Big translucent monogram of the app's name. */}
            <span className="absolute -bottom-6 right-3 select-none font-[family-name:var(--font-display)] text-8xl font-bold text-white/10 transition-transform duration-700 group-hover:-translate-y-2">
              {listing.title.slice(0, 2)}
            </span>
            <div className="absolute left-4 top-4 flex flex-wrap gap-2">
              <span className="chip backdrop-blur-md">{listing.category}</span>
            </div>
            {verified && (
              <span
                className="chip chip-green absolute right-4 top-4 backdrop-blur-md"
                title={`AI verification passed — quality score ${listing.aiQualityScore ?? "-"}/100`}
              >
                {/* Pulsing live dot. */}
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-300" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                </span>
                AI Verified {listing.aiQualityScore ?? ""}
              </span>
            )}
          </div>

          {/* Body */}
          <div className="flex flex-1 flex-col p-5">
            <ViewTransition name={`listing-title-${listing.id}`} share="morph" default="none">
              <h3 className="text-lg font-semibold text-white transition-colors group-hover:text-cyan-200">
                {listing.title}
              </h3>
            </ViewTransition>
            <p className="text-muted mt-1.5 line-clamp-2 flex-1 text-sm">{listing.tagline ?? ""}</p>
            <div className="mt-5 flex items-end justify-between">
              <span className="text-dim text-xs">by {listing.sellerName}</span>
              <span className="font-mono text-lg font-bold text-white">
                {formatUsd(listing.priceCents)}
              </span>
            </div>
            {/* Hover CTA that slides in from below. */}
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-cyan-300 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
              View business
              <span aria-hidden>→</span>
            </div>
          </div>
        </div>
      </SpotlightCard>
    </Link>
  );
}

/** Convert a hue to an "r,g,b" string at fixed saturation/lightness. */
function hslToRgbTriplet(h: number, s = 0.9, l = 0.62): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)).join(",");
}
