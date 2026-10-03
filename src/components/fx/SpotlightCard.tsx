"use client";

/**
 * SpotlightCard — glass card with two interactive effects:
 *
 *   1. 3D tilt: the card rotates towards the cursor using spring physics.
 *   2. Spotlight: a radial glow follows the cursor across the surface and
 *      lights up the border.
 *
 * Both effects are disabled for reduced-motion users and on touch devices
 * (no hover), where the card simply renders as a static glass panel.
 */
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import type { PointerEvent, ReactNode } from "react";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  /** RGB triplet for the glow colour, e.g. "139,92,246". */
  glow?: string;
  /** Max tilt angle in degrees. */
  tilt?: number;
}

export function SpotlightCard({
  children,
  className = "",
  glow = "139,92,246",
  tilt = 8,
}: SpotlightCardProps) {
  const reduce = useReducedMotion();

  // Pointer position normalised to 0..1 within the card.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);

  // Springs smooth out the raw pointer values for a "weighty" tilt.
  const sx = useSpring(px, { stiffness: 180, damping: 18 });
  const sy = useSpring(py, { stiffness: 180, damping: 18 });
  const rotateX = useTransform(sy, [0, 1], [tilt, -tilt]);
  const rotateY = useTransform(sx, [0, 1], [-tilt, tilt]);

  // Spotlight position in percentages for the radial gradient.
  const gx = useTransform(px, (v) => `${v * 100}%`);
  const gy = useTransform(py, (v) => `${v * 100}%`);
  const spotlight = useMotionTemplate`radial-gradient(420px circle at ${gx} ${gy}, rgba(${glow},0.22), transparent 55%)`;
  const rim = useMotionTemplate`radial-gradient(260px circle at ${gx} ${gy}, rgba(${glow},0.9), transparent 60%)`;

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (reduce || e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  }

  function onLeave() {
    // Ease back to the neutral, flat position.
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 900 }}
      className={`group relative isolate rounded-2xl ${className}`}
    >
      {/* Glowing rim — a masked gradient layer that only shows the 1px border. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: rim,
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: 1,
        }}
      />
      {/* Glass body. */}
      <div className="glass relative h-full overflow-hidden rounded-2xl">
        {/* Inner spotlight wash. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: spotlight }}
        />
        <div className="relative h-full">{children}</div>
      </div>
    </motion.div>
  );
}
