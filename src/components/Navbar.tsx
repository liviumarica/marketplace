"use client";

/**
 * Global navigation bar — a floating glass "pill" that:
 *   - shrinks and gains a stronger blur/glow once the page is scrolled,
 *   - highlights the active route with an animated sliding indicator
 *     (motion `layoutId`), and
 *   - collapses into an animated full-width sheet on mobile.
 *
 * Session-dependent actions: login/sign-up for guests; dashboard, settings,
 * sell and logout for signed-in users. Logout is a plain HTML form POST to
 * /api/auth/logout — the server clears the cookie and answers with a 303
 * redirect, so the browser does a full navigation and no stale signed-in UI
 * can survive in the client router cache.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { Magnetic } from "@/components/fx/Magnetic";

interface NavbarProps {
  user: { name: string; email: string; role: string } | null;
}

// Primary marketplace sections.
const LINKS = [
  { href: "/", label: "Browse apps" },
  { href: "/requests", label: "Custom builds" },
  { href: "/chat", label: "AI Agent" },
];

/** True when `href` is the current section (exact for "/", prefix otherwise). */
function isActive(pathname: string, href: string): boolean {
  // "Browse" also covers listing detail pages (but not the sell form).
  if (href === "/") {
    return pathname === "/" || (pathname.startsWith("/listings/") && !pathname.endsWith("/new"));
  }
  return pathname.startsWith(href);
}

/** Real POST form that logs the user out (see /api/auth/logout). */
function LogoutForm({ className, label, title }: { className: string; label: string; title?: string }) {
  return (
    <form action="/api/auth/logout" method="post">
      <button type="submit" className={className} title={title}>
        {label}
      </button>
    </form>
  );
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // Flip into the compact state after a small scroll distance.
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3"
      // Anchors the header during view transitions (see globals.css).
      style={{ viewTransitionName: "site-header" }}
    >
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`flex w-full items-center justify-between rounded-2xl border transition-all duration-500 ${
          scrolled
            ? "max-w-5xl border-white/15 bg-[#0a0b1a]/70 px-3 py-2 shadow-[0_10px_40px_-10px_rgba(139,92,246,0.5)] backdrop-blur-2xl"
            : "max-w-6xl border-white/5 bg-white/[0.02] px-4 py-3 backdrop-blur-md"
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 items-center justify-center">
              {/* Spinning neon ring around the monogram. */}
              <span className="neon-border absolute inset-0 rounded-lg" />
              <span className="relative font-mono text-xs font-bold text-white">AB</span>
            </span>
            <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-white">
              Agent<span className="text-gradient">Bay</span>
            </span>
          </Link>

          {/* Desktop links with the sliding active indicator */}
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {LINKS.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`relative rounded-lg px-3 py-1.5 transition-colors ${
                    active ? "text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 -z-10 rounded-lg border border-white/10 bg-white/[0.07]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Session actions (desktop) */}
        <div className="hidden items-center gap-2 text-sm md:flex">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  pathname.startsWith("/dashboard") ? "text-white" : "text-white/60 hover:text-white"
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  pathname.startsWith("/settings") ? "text-white" : "text-white/60 hover:text-white"
                }`}
                title={user.email}
              >
                Settings
              </Link>
              <LogoutForm
                className="rounded-lg px-3 py-1.5 text-white/60 transition-colors hover:text-white"
                label="Log out"
                title={user.email}
              />
              <Magnetic>
                <Link href="/listings/new" className="btn-primary !rounded-xl !px-4 !py-2 !text-sm">
                  Sell your app
                </Link>
              </Magnetic>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-white/60 transition-colors hover:text-white"
              >
                Log in
              </Link>
              <Magnetic>
                <Link href="/register" className="btn-primary !rounded-xl !px-4 !py-2 !text-sm">
                  Sign up
                </Link>
              </Magnetic>
            </>
          )}
        </div>

        {/* Mobile menu toggle — animated hamburger ⇄ close icon */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <motion.span
            className="absolute h-px w-4 bg-white"
            animate={open ? { rotate: 45, y: 0 } : { rotate: 0, y: -4 }}
          />
          <motion.span
            className="absolute h-px w-4 bg-white"
            animate={open ? { rotate: -45, y: 0 } : { rotate: 0, y: 4 }}
          />
        </button>
      </motion.div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="glass-strong absolute inset-x-3 top-[4.5rem] flex flex-col gap-1 rounded-2xl p-3 md:hidden"
          >
            {[
              ...LINKS,
              ...(user
                ? [
                    { href: "/dashboard", label: "Dashboard" },
                    { href: "/settings", label: "Settings" },
                    { href: "/listings/new", label: "Sell your app" },
                  ]
                : [
                    { href: "/login", label: "Log in" },
                    { href: "/register", label: "Sign up" },
                  ]),
            ].map((l, i) => (
              <motion.div
                key={l.href}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i }}
              >
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-4 py-3 text-white/80 hover:bg-white/5 hover:text-white"
                >
                  {l.label}
                </Link>
              </motion.div>
            ))}
            {user && (
              <LogoutForm
                className="w-full rounded-xl px-4 py-3 text-left text-white/60 hover:bg-white/5 hover:text-white"
                label={`Log out (${user.email})`}
              />
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
