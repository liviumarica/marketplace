"use client";

/**
 * AnimatedCounter — counts up from 0 to a REAL value (passed in from a
 * server query) the first time it scrolls into view.
 *
 * Formatting:
 *   - "int": 1,234
 *   - "usd": value is in cents → $12,340
 */
import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

interface AnimatedCounterProps {
  value: number;
  format?: "int" | "usd";
  /** Animation duration in seconds. */
  duration?: number;
  className?: string;
}

/** Turn the raw number into display text for the chosen format. */
function formatValue(v: number, format: "int" | "usd"): string {
  if (format === "usd") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(v / 100);
  }
  return new Intl.NumberFormat("en-US").format(Math.round(v));
}

export function AnimatedCounter({
  value,
  format = "int",
  duration = 2,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    // Reduced motion: jump straight to the final value.
    if (reduce) {
      el.textContent = formatValue(value, format);
      return;
    }
    // Write directly to the DOM each frame — avoids React re-renders.
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = formatValue(v, format);
      },
    });
    return () => controls.stop();
  }, [inView, value, format, duration, reduce]);

  // Server-rendered initial text is 0 so there is no layout jump.
  return (
    <span ref={ref} className={className}>
      {formatValue(0, format)}
    </span>
  );
}
