/**
 * Marquee — infinite horizontal ticker (pure CSS, server-renderable).
 *
 * The item list is rendered twice back-to-back and the track is translated
 * by -50%, which produces a seamless loop. Edges fade out via a CSS mask.
 * Pauses on hover so users can read an item.
 */
import type { CSSProperties, ReactNode } from "react";

interface MarqueeProps {
  items: ReactNode[];
  /** Seconds for one full loop. */
  duration?: number;
  /** Scroll right-to-left (default) or left-to-right. */
  reverse?: boolean;
  className?: string;
}

export function Marquee({ items, duration = 40, reverse = false, className }: MarqueeProps) {
  if (items.length === 0) return null;
  return (
    <div
      className={`group relative flex overflow-hidden ${className ?? ""}`}
      style={{
        maskImage: "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
      }}
    >
      <div
        className="animate-marquee flex w-max shrink-0 gap-4 pr-4 group-hover:[animation-play-state:paused]"
        style={
          {
            "--marquee-duration": `${duration}s`,
            animationDirection: reverse ? "reverse" : "normal",
          } as CSSProperties
        }
      >
        {/* Two copies of the list make the -50% translation seamless. */}
        {[...items, ...items].map((item, i) => (
          <div key={i} aria-hidden={i >= items.length} className="shrink-0">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
