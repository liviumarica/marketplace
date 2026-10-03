"use client";

/**
 * HeroSceneLazy — client-only, code-split loader for the 3D hero.
 *
 * three.js is large and needs `window`/WebGL, so it is excluded from SSR and
 * the initial JS bundle. Until it loads (or if WebGL is unavailable, or the
 * user prefers reduced motion) a pure-CSS glowing orb is shown instead, so
 * the hero never looks empty.
 */
import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import type { HeroCard } from "./HeroScene";

const HeroScene = dynamic(() => import("./HeroScene"), {
  ssr: false,
  loading: () => null,
});

export function HeroSceneLazy({ cards }: { cards: HeroCard[] }) {
  const reduce = useReducedMotion();

  return (
    <div className="relative h-full w-full">
      {/* CSS fallback orb — visible behind / before the WebGL canvas. */}
      <div aria-hidden className="absolute inset-0 flex items-center justify-center">
        <div
          className="animate-float h-56 w-56 rounded-full blur-[2px]"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, #c4b5fd 0%, #8b5cf6 30%, #0891b2 60%, transparent 72%)",
            boxShadow: "0 0 120px 30px rgba(139,92,246,0.45), 0 0 220px 60px rgba(34,211,238,0.25)",
            opacity: 0.55,
          }}
        />
      </div>
      {!reduce && <HeroScene cards={cards} />}
    </div>
  );
}
