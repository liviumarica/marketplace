"use client";

/**
 * AuthShell — shared frame for the login / register pages: a neon-bordered
 * glass card floating over drifting orbs, with a springy entrance.
 */
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { PageTransition } from "./PageTransition";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthShell({ eyebrow, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <PageTransition>
      <div className="relative mx-auto flex min-h-[calc(100svh-12rem)] max-w-md flex-col justify-center px-4 py-12">
        {/* Floating decorative orbs behind the card. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="animate-float absolute -left-24 top-10 h-48 w-48 rounded-full bg-violet-600/30 blur-3xl" />
          <div className="animate-float absolute -right-24 bottom-10 h-56 w-56 rounded-full bg-cyan-500/25 blur-3xl [animation-delay:2s]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96, rotateX: 12 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          style={{ transformPerspective: 900 }}
          className="neon-border relative rounded-3xl p-8 shadow-[0_0_100px_-30px_rgba(139,92,246,0.9)]"
        >
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold text-white">{title}</h1>
          <p className="text-muted mt-2 text-sm">{subtitle}</p>
          <div className="mt-7">{children}</div>
          <div className="text-muted mt-6 text-sm">{footer}</div>
        </motion.div>
      </div>
    </PageTransition>
  );
}
