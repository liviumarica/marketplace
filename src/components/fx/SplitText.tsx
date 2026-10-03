"use client";

/**
 * SplitText — headline reveal that animates word by word.
 *
 * Each word rises from behind an overflow mask with a slight rotation and
 * blur, creating a cinematic "type-set" entrance. The full sentence is still
 * exposed to screen readers via `aria-label`, while the animated spans are
 * hidden from the accessibility tree.
 */
import { motion, useReducedMotion } from "motion/react";

interface SplitTextProps {
  text: string;
  className?: string;
  /** Extra classes applied to every word (e.g. "text-gradient"). */
  wordClassName?: string;
  /** Seconds before the first word animates. */
  delay?: number;
  /** Seconds between consecutive words. */
  stagger?: number;
}

export function SplitText({
  text,
  className,
  wordClassName,
  delay = 0,
  stagger = 0.06,
}: SplitTextProps) {
  const reduce = useReducedMotion();
  const words = text.split(" ");

  return (
    <span className={className} aria-label={text} role="text">
      {words.map((word, i) => (
        // The outer span clips the word so it appears to rise out of a slot.
        <span
          key={`${word}-${i}`}
          aria-hidden
          className="inline-block overflow-hidden pb-[0.12em] align-bottom"
        >
          <motion.span
            className={`inline-block ${wordClassName ?? ""}`}
            initial={
              reduce ? false : { y: "110%", rotate: 6, opacity: 0, filter: "blur(8px)" }
            }
            animate={{ y: "0%", rotate: 0, opacity: 1, filter: "blur(0px)" }}
            transition={{
              duration: 0.9,
              delay: delay + i * stagger,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {word}
            {/* Preserve the space between words. */}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
