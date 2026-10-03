"use client";

/**
 * ScrollProgress — a thin aurora-coloured bar pinned to the very top of the
 * viewport that fills up as the user scrolls through the page.
 */
import { motion, useScroll, useSpring } from "motion/react";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  // Spring-smoothed so the bar glides rather than jumps.
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left"
      style={{
        scaleX,
        background: "linear-gradient(90deg, #8b5cf6, #22d3ee, #e879f9)",
        boxShadow: "0 0 12px rgba(34,211,238,0.8)",
      }}
    />
  );
}
