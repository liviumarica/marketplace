"use client";

/**
 * Reveal — scroll-triggered entrance animation.
 *
 * Children fade in, un-blur and slide up the first time they enter the
 * viewport. `delay` lets callers build manual staggers; `y` controls the
 * travel distance. Uses `motion` so it is GPU-friendly (transform/opacity).
 */
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** Seconds to wait before animating (for staggering siblings). */
  delay?: number;
  /** Vertical travel distance in px. */
  y?: number;
  className?: string;
  /** Render as a different element (e.g. "section", "li"). */
  as?: "div" | "section" | "li" | "article" | "span";
}

export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as = "div",
}: RevealProps) {
  const reduce = useReducedMotion();
  // Pick the motion element matching the requested tag.
  const Comp = motion[as];

  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      // Trigger once, slightly before the element is fully visible.
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Comp>
  );
}
