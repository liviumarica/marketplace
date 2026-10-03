"use client";

/**
 * ScoreRing — circular gauge for the AI quality score (0-100).
 *
 * The SVG arc draws itself when it scrolls into view, using a gradient
 * stroke that shifts from violet to cyan. The number in the middle is the
 * real score stored on the listing / verification run.
 */
import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

interface ScoreRingProps {
  score: number;
  /** Diameter in px. */
  size?: number;
  /** Stroke width in px. */
  stroke?: number;
  /** Show the "/100" caption under the number. */
  caption?: boolean;
}

export function ScoreRing({ score, size = 96, stroke = 8, caption = true }: ScoreRingProps) {
  const reduce = useReducedMotion();
  const gradientId = useId();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Clamp to a valid range so bad data can't break the drawing.
  const pct = Math.max(0, Math.min(100, score)) / 100;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="55%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a3e635" />
          </linearGradient>
        </defs>
        {/* Background track. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        {/* Animated value arc. */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduce ? circumference * (1 - pct) : circumference }}
          whileInView={{ strokeDashoffset: circumference * (1 - pct) }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: "drop-shadow(0 0 6px rgba(34,211,238,0.7))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-mono font-bold text-white" style={{ fontSize: size * 0.28 }}>
          {score}
        </span>
        {caption && <span className="text-dim mt-0.5 text-[10px]">/100</span>}
      </div>
    </div>
  );
}
