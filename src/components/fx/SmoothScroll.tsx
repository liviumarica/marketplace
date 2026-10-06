"use client";

/**
 * SmoothScroll — wires up Lenis for buttery, inertia-based page scrolling.
 *
 * - Runs a single requestAnimationFrame loop that drives Lenis.
 * - Skipped entirely for users with `prefers-reduced-motion: reduce`, so the
 *   browser's native scrolling is used instead.
 * - Scrollable inner areas (chat stream, grids) can opt out by adding the
 *   `data-lenis-prevent` attribute; textareas/selects scroll natively too.
 * - Form safety: the inertia glide keeps moving the page for ~1s after the
 *   wheel stops. If the user clicks or focuses a field during that glide the
 *   page kept sliding under them, so the click / typing could land in a
 *   DIFFERENT field. Any pointer-down or focus on a form control therefore
 *   stops the glide instantly, right where it is.
 */
import { useEffect } from "react";
import Lenis from "lenis";

/** Elements the user types into or picks from. */
const FORM_CONTROL = "input, textarea, select, button, [contenteditable='true'], label";

export function SmoothScroll(): null {
  useEffect(() => {
    // Respect the OS-level accessibility preference.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // `lerp` controls how "floaty" the scroll feels (lower = smoother).
    const lenis = new Lenis({
      lerp: 0.09,
      wheelMultiplier: 1,
      smoothWheel: true,
      // Let multi-line fields and dropdowns scroll their own content natively.
      prevent: (node) => node.tagName === "TEXTAREA" || node.tagName === "SELECT",
    });

    /** Freeze any in-flight glide at the current position. */
    const halt = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.(FORM_CONTROL)) return;
      lenis.scrollTo(window.scrollY, { immediate: true, force: true });
    };
    // Capture phase: runs before the browser moves focus / scrolls into view.
    document.addEventListener("pointerdown", halt, true);
    document.addEventListener("focusin", halt, true);

    let frame = 0;
    // Drive Lenis from the browser's animation loop.
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    // Clean up on unmount (e.g. during fast refresh).
    return () => {
      document.removeEventListener("pointerdown", halt, true);
      document.removeEventListener("focusin", halt, true);
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  // Purely behavioural — renders nothing.
  return null;
}
