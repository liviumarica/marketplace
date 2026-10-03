"use client";

/**
 * SmoothScroll — wires up Lenis for buttery, inertia-based page scrolling.
 *
 * - Runs a single requestAnimationFrame loop that drives Lenis.
 * - Skipped entirely for users with `prefers-reduced-motion: reduce`, so the
 *   browser's native scrolling is used instead.
 * - Scrollable inner areas (chat stream, grids) can opt out by adding the
 *   `data-lenis-prevent` attribute.
 */
import { useEffect } from "react";
import Lenis from "lenis";

export function SmoothScroll(): null {
  useEffect(() => {
    // Respect the OS-level accessibility preference.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // `lerp` controls how "floaty" the scroll feels (lower = smoother).
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });

    let frame = 0;
    // Drive Lenis from the browser's animation loop.
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    // Clean up on unmount (e.g. during fast refresh).
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  // Purely behavioural — renders nothing.
  return null;
}
