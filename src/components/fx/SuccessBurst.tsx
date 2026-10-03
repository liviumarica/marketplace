"use client";

/**
 * SuccessBurst — celebratory success badge: a glowing check that pops in
 * with a spring, surrounded by neon particles that burst outward once.
 * Used on confirmed-payment screens.
 */
import { motion, useReducedMotion } from "motion/react";

// 14 particles evenly spread around the circle, alternating colours.
const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  return {
    x: Math.cos(angle) * 52,
    y: Math.sin(angle) * 52,
    color: ["#22d3ee", "#a78bfa", "#e879f9", "#a3e635"][i % 4],
  };
});

export function SuccessBurst() {
  const reduce = useReducedMotion();

  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      {!reduce &&
        PARTICLES.map((p, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ background: p.color, boxShadow: `0 0 8px ${p.color}` }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4 }}
            transition={{ duration: 1.1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      <motion.span
        initial={reduce ? false : { scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 14 }}
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 text-2xl font-bold text-[#05060f] shadow-[0_0_40px_rgba(52,211,153,0.8)]"
      >
        ✓
      </motion.span>
    </div>
  );
}
