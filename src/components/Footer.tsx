/**
 * Footer — closes every page with a giant glowing wordmark, quick links and
 * the technology partners that actually power the platform (PayPal for the
 * split payments & escrow, KERNEL for AI verification in a cloud browser,
 * Elastic for semantic search).
 */
import Link from "next/link";

const COLUMNS = [
  {
    title: "Marketplace",
    links: [
      { href: "/", label: "Browse apps" },
      { href: "/listings/new", label: "Sell your app" },
      { href: "/chat", label: "AI shopping agent" },
    ],
  },
  {
    title: "Custom builds",
    links: [
      { href: "/requests", label: "Open requests" },
      { href: "/requests/new", label: "Post a request" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
];

const POWERED_BY = ["PayPal", "KERNEL", "Elastic", "OpenAI", "Channel3"];

export function Footer() {
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-white/10">
      {/* Glowing horizon line on top of the footer. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, #8b5cf6, #22d3ee, #e879f9, transparent)",
          boxShadow: "0 0 30px 2px rgba(139,92,246,0.6)",
        }}
      />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="font-[family-name:var(--font-display)] text-xl font-bold text-white">
            Agent<span className="text-gradient">Bay</span>
          </p>
          <p className="text-muted mt-3 max-w-sm text-sm">
            The marketplace where AI-built software changes hands. Every app is
            verified by an autonomous agent; every payment splits automatically
            via PayPal.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {POWERED_BY.map((p) => (
              <span key={p} className="chip">
                {p}
              </span>
            ))}
          </div>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="eyebrow">{col.title}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-white/60 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Giant outlined wordmark that bleeds off the bottom edge. */}
      <div aria-hidden className="pointer-events-none select-none overflow-hidden">
        <p
          className="-mb-[0.22em] text-center font-[family-name:var(--font-display)] text-[22vw] font-bold leading-none tracking-tighter"
          style={{
            WebkitTextStroke: "1px rgba(255,255,255,0.12)",
            color: "transparent",
            backgroundImage: "linear-gradient(180deg, rgba(139,92,246,0.25), transparent 70%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
          }}
        >
          AgentBay
        </p>
      </div>

      <div className="border-t border-white/5 py-5 text-center text-xs text-white/40">
        AgentBay — PayPal AI Hackathon project · PayPal + AI · Sandbox payments
      </div>
    </footer>
  );
}
