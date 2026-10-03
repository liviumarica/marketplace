"use client";

/**
 * CosmicBackground — the fixed, full-viewport backdrop behind every page.
 *
 * Layers (back → front):
 *   1. Deep-space base colour (from <body>).
 *   2. Three huge blurred aurora blobs that drift slowly (pure CSS keyframes).
 *   3. A procedurally generated star field drawn once on a <canvas>.
 *   4. A soft radial "spotlight" that follows the mouse cursor.
 *   5. A faint film-grain/vignette overlay for depth.
 *
 * Everything is `pointer-events: none` so it never blocks interaction.
 */
import { useEffect, useRef } from "react";

export function CosmicBackground() {
  const spotRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLCanvasElement>(null);

  // --- Mouse-follow spotlight ------------------------------------------------
  useEffect(() => {
    const el = spotRef.current;
    if (!el) return;
    let frame = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 3;

    // Update CSS variables at most once per animation frame (cheap).
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${x}px`);
        el.style.setProperty("--my", `${y}px`);
        frame = 0;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  // --- Star field (drawn once per resize, no per-frame cost) ----------------
  useEffect(() => {
    const canvas = starsRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Star density scales with the viewport area.
      const count = Math.floor((w * h) / 4200);
      for (let i = 0; i < count; i++) {
        const sx = Math.random() * w;
        const sy = Math.random() * h;
        const r = Math.random() * 1.1 + 0.15;
        // A few stars get a cyan/violet tint for a "neon nebula" feel.
        const tint = Math.random();
        const color =
          tint > 0.94
            ? "rgba(34,211,238,"
            : tint > 0.88
              ? "rgba(196,181,253,"
              : "rgba(255,255,255,";
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = `${color}${(Math.random() * 0.6 + 0.15).toFixed(2)})`;
        ctx.fill();
      }
    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Aurora blobs — huge, blurred, slowly drifting gradients. */}
      <div
        className="absolute -left-[20%] -top-[25%] h-[70vmax] w-[70vmax] rounded-full opacity-40 blur-[120px]"
        style={{
          background: "radial-gradient(circle, #7c3aed 0%, transparent 65%)",
          animation: "aurora-drift 26s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -right-[25%] top-[10%] h-[60vmax] w-[60vmax] rounded-full opacity-30 blur-[120px]"
        style={{
          background: "radial-gradient(circle, #06b6d4 0%, transparent 65%)",
          animation: "aurora-drift 32s ease-in-out infinite reverse",
        }}
      />
      <div
        className="absolute -bottom-[30%] left-[20%] h-[60vmax] w-[60vmax] rounded-full opacity-25 blur-[130px]"
        style={{
          background: "radial-gradient(circle, #c026d3 0%, transparent 65%)",
          animation: "aurora-drift 38s ease-in-out infinite",
        }}
      />

      {/* Static star field. */}
      <canvas ref={starsRef} className="absolute inset-0 opacity-70" />

      {/* Cursor spotlight — position driven by CSS vars set in the effect. */}
      <div
        ref={spotRef}
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(600px circle at var(--mx, 50%) var(--my, 30%), rgba(139,92,246,0.13), transparent 60%)",
        }}
      />

      {/* Vignette to focus attention towards the centre. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(2,3,10,0.85) 100%)",
        }}
      />
    </div>
  );
}
