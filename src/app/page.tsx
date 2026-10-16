/**
 * Home / browse page — the cinematic landing + the live catalogue.
 *
 * Sections:
 *   1. Hero: split-text headline, glowing search, CTAs, interactive 3D
 *      "AI core" whose orbiting holograms are the real top listings.
 *   2. Live stats: real aggregates from the database, counting up.
 *   3. Marquee: real categories + tech stacks used by listed apps.
 *   4. How it works: the three-step trust pipeline.
 *   5. Listings grid / search results.
 *   6. Two-sided CTA (sell vs. buy).
 *
 * A query param `?q=` filters through the semantic search endpoint when
 * Elastic is configured, falling back to a SQL LIKE search otherwise.
 */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { searchListingsSemantic } from "@/lib/elastic";
import { formatUsd } from "@/lib/money";
import { ListingCard } from "@/components/ListingCard";
import { PageTransition } from "@/components/fx/PageTransition";
import { HeroSceneLazy } from "@/components/fx/HeroSceneLazy";
import { SplitText } from "@/components/fx/SplitText";
import { Reveal } from "@/components/fx/Reveal";
import { Magnetic } from "@/components/fx/Magnetic";
import { AnimatedCounter } from "@/components/fx/AnimatedCounter";
import { Marquee } from "@/components/fx/Marquee";
import { SpotlightCard } from "@/components/fx/SpotlightCard";

const sellerInclude = { seller: { select: { name: true } } } as const;

interface HomeProps {
  searchParams: Promise<{ q?: string; verified?: string }>;
}

/** The three steps of the AgentBay trust pipeline. */
const STEPS = [
  {
    n: "01",
    title: "List in seconds",
    body: "Paste a repo or demo URL. The AI autopilot reads it and writes your listing, then suggests a fair price.",
    glow: "139,92,246",
  },
  {
    n: "02",
    title: "Verified by an AI agent",
    body: "An autonomous agent opens your app in a real cloud browser (KERNEL), clicks through it and scores its quality.",
    glow: "34,211,238",
  },
  {
    n: "03",
    title: "Paid through PayPal",
    body: "Buyers check out with PayPal. The payment splits automatically between seller and platform — no invoices, no chasing.",
    glow: "232,121,249",
  },
];

export default async function Home({ searchParams }: HomeProps) {
  const { q, verified } = await searchParams;
  const query = q?.trim() ?? "";
  const onlyVerified = verified === "1";
  const verifiedFilter = onlyVerified ? { verificationStatus: "PASSED" } : {};

  // Search order: real Elastic hybrid (kNN + BM25) when reachable, plain SQL
  // LIKE otherwise. Both paths return real listing rows — never fixtures.
  let listings;
  if (query) {
    const hits = await searchListingsSemantic(query);
    if (hits && hits.length > 0) {
      const rows = await prisma.listing.findMany({
        where: { id: { in: hits.map((h) => h.id) }, status: "ACTIVE", ...verifiedFilter },
        include: sellerInclude,
      });
      // Preserve the relevance order Elasticsearch returned.
      const rank = new Map(hits.map((h, i) => [h.id, i]));
      rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
      listings = rows;
    } else {
      listings = await prisma.listing.findMany({
        where: {
          status: "ACTIVE",
          ...verifiedFilter,
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
            { category: { contains: query } },
            { techStack: { contains: query } },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: sellerInclude,
      });
    }
  } else {
    listings = await prisma.listing.findMany({
      where: { status: "ACTIVE", ...verifiedFilter },
      orderBy: { createdAt: "desc" },
      include: sellerInclude,
    });
  }

  // ---- Real marketplace metrics for the hero / stats strip ---------------
  const [activeCount, verifiedCount, paidVolume, openRequests, catalogue] = await Promise.all([
    prisma.listing.count({ where: { status: "ACTIVE" } }),
    prisma.listing.count({ where: { status: "ACTIVE", verificationStatus: "PASSED" } }),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { totalCents: true } }),
    prisma.customRequest.count({ where: { status: "OPEN" } }),
    // Most recent active listings power the 3D holograms + the marquee.
    prisma.listing.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        priceCents: true,
        category: true,
        techStack: true,
        verificationStatus: true,
      },
    }),
  ]);

  // Holographic cards orbiting the 3D core (max 8 most recent for legibility).
  const heroCards = catalogue.slice(0, 8).map((l) => ({
    id: l.id,
    title: l.title,
    priceLabel: formatUsd(l.priceCents),
    category: l.category,
    verified: l.verificationStatus === "PASSED",
  }));

  // Unique categories + tech stack tags across the live catalogue.
  const tags = Array.from(
    new Set(
      catalogue.flatMap((l) => {
        let stack: string[] = [];
        try {
          stack = JSON.parse(l.techStack || "[]");
        } catch {
          stack = [];
        }
        return [l.category, ...stack];
      }),
    ),
  );

  const stats = [
    { label: "Apps for sale", value: activeCount, format: "int" as const, href: "/#listings" },
    { label: "AI-verified", value: verifiedCount, format: "int" as const, href: "/?verified=1#listings" },
    { label: "Paid through PayPal", value: paidVolume._sum.totalCents ?? 0, format: "usd" as const, href: "/#how-it-works" },
    { label: "Open custom builds", value: openRequests, format: "int" as const, href: "/requests" },
  ];
  // A row of zeros undermines trust on a brand-new marketplace, so live
  // numbers are only shown once there is real activity; until then the
  // strip states the platform's guarantees instead (all true, nothing faked).
  const hasActivity = stats.some((s) => s.value > 0);
  const guarantees = [
    { title: "Full ownership", body: "Source code, brand & docs transfer to you", href: "/#listings" },
    { title: "AI-tested", body: "An agent runs each demo and scores it", href: "/#how-it-works" },
    { title: "PayPal checkout", body: "Pay with PayPal — no card details shared", href: "/#how-it-works" },
    { title: "Escrow for builds", body: "Custom work is paid only on delivery", href: "/requests" },
  ];

  return (
    <PageTransition>
      <div>
        {/* ================================================================
         * 1. HERO
         * ============================================================== */}
        <section className="relative -mt-24 flex min-h-[88svh] items-center overflow-hidden pt-32 pb-16 md:pt-36 md:pb-20">
          {/* Perspective grid floor glowing at the horizon. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] opacity-50">
            <div className="grid-floor absolute inset-x-[-50%] top-0 h-[200%]" />
          </div>

          {/* 3D scene — right half on desktop, dimmed backdrop on mobile. */}
          <div className="absolute inset-0 opacity-40 lg:left-[38%] lg:opacity-100">
            <HeroSceneLazy cards={heroCards} />
          </div>

          {/* pointer-events-none on the full-width wrapper so the right half
              does not block hover/click events on the 3D orbiting cards;
              pointer-events-auto re-enables interaction on the left column. */}
          <div className="pointer-events-none relative z-10 mx-auto w-full max-w-6xl px-4">
            <div className="pointer-events-auto max-w-xl">
              <Reveal>
                <span className="chip chip-violet">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-cyan-300" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
                  </span>
                  {activeCount > 0
                    ? `${activeCount} SaaS app${activeCount === 1 ? "" : "s"} for sale right now`
                    : "Now open — founding sellers welcome"}
                </span>
              </Reveal>

              <h1 className="mt-6 text-5xl font-bold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
                <SplitText text="Buy a working SaaS app." />
                <br />
                <SplitText
                  text="Or get one built for you."
                  wordClassName="text-gradient"
                  delay={0.35}
                />
              </h1>

              <Reveal delay={0.6}>
                <p className="text-muted mt-6 max-w-xl text-lg">
                  AgentBay is a marketplace for software made with AI. Buy a
                  complete app — source code, brand and docs — after an AI agent
                  has tested it, or post a brief and hire a developer with your
                  payment held in PayPal escrow until delivery.
                </p>
              </Reveal>

              {/* Glowing search — same GET form as before. */}
              <Reveal delay={0.75}>
                <form action="/" method="get" className="neon-border mt-8 flex items-center gap-2 rounded-2xl p-1.5 shadow-[0_0_60px_-15px_rgba(139,92,246,0.7)]">
                  <span aria-hidden className="pl-3 text-white/50">
                    ⌕
                  </span>
                  <input
                    type="text"
                    name="q"
                    defaultValue={query}
                    placeholder="Search apps — e.g. 'invoicing tool for freelancers'"
                    className="flex-1 bg-transparent px-1 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none"
                  />
                  <button type="submit" className="btn-primary !rounded-xl !py-2.5">
                    Search
                  </button>
                </form>
              </Reveal>

              <Reveal delay={0.9}>
                <div className="relative z-20 mt-6 flex flex-wrap items-center gap-3">
                  <Magnetic>
                    <Link href="/listings/new" className="btn-primary">
                      Sell your AI-built app <span aria-hidden>→</span>
                    </Link>
                  </Magnetic>
                  <Magnetic>
                    <Link href="/requests/new" className="btn-ghost">
                      Order a custom app
                    </Link>
                  </Magnetic>
                  <Link href="/chat" className="group flex items-center gap-2 px-2 text-sm text-white/70 hover:text-white">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 transition group-hover:border-cyan-300/60 group-hover:shadow-[0_0_20px_-4px_rgba(34,211,238,0.8)]">
                      ✦
                    </span>
                    Ask the AI agent
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ================================================================
         * 2. LIVE STATS (real aggregates, each card clickable)
         * ============================================================== */}
        <section className="relative z-10 mx-auto mt-6 max-w-6xl px-4">
          <Reveal>
            <div className="glass-strong grid grid-cols-2 divide-white/10 overflow-hidden rounded-3xl md:grid-cols-4 md:divide-x">
              {hasActivity
                ? stats.map((s) => (
                    <Link
                      key={s.label}
                      href={s.href}
                      className="group relative block px-6 py-7 text-center transition-colors hover:bg-white/[0.05]"
                    >
                      <AnimatedCounter
                        value={s.value}
                        format={s.format}
                        className="text-gradient-soft font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl"
                      />
                      <p className="text-dim mt-1 flex items-center justify-center gap-1 text-xs uppercase tracking-[0.18em] transition-colors group-hover:text-cyan-200">
                        {s.label}
                        <span
                          aria-hidden
                          className="inline-block opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                        >
                          →
                        </span>
                      </p>
                    </Link>
                  ))
                : guarantees.map((g) => (
                    <Link
                      key={g.title}
                      href={g.href}
                      className="group relative block px-6 py-7 text-center transition-colors hover:bg-white/[0.05]"
                    >
                      <p className="text-gradient-soft font-[family-name:var(--font-display)] text-xl font-bold md:text-2xl">
                        {g.title}
                      </p>
                      <p className="text-dim mt-1 text-xs transition-colors group-hover:text-cyan-200">{g.body}</p>
                    </Link>
                  ))}
            </div>
          </Reveal>
        </section>

        {/* ================================================================
         * 3. LATEST LISTINGS (right below the hero & stats strip)
         * ============================================================== */}
        <section id="listings" className="mx-auto mt-20 max-w-6xl scroll-mt-28 px-4">
          <Reveal>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">
                  {query ? "Search results" : onlyVerified ? "Verified catalogue" : "Recently listed"}
                </p>
                <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">
                  {query ? (
                    <>
                      Results for <span className="text-gradient">“{query}”</span>
                    </>
                  ) : onlyVerified ? (
                    <>
                      <span className="text-gradient">AI-verified</span> SaaS apps
                    </>
                  ) : (
                    <>
                      Latest <span className="text-gradient">SaaS apps</span> for sale
                    </>
                  )}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onlyVerified && (
                  <Link href="/#listings" className="chip chip-cyan hover:border-cyan-300/60">
                    ✕ Clear verified filter
                  </Link>
                )}
                <span className="chip">
                  {listings.length} listing{listings.length === 1 ? "" : "s"} · newest first
                </span>
              </div>
            </div>
          </Reveal>

          {listings.length === 0 ? (
            <Reveal>
              {query ? (
                // Search with no hits — suggest broadening or asking the agent.
                <div className="glass rounded-3xl p-14 text-center">
                  <p className="font-semibold text-white">Nothing matches “{query}” yet.</p>
                  <p className="text-muted mx-auto mt-2 max-w-md text-sm">
                    Try a broader search, or post a request and let developers build exactly what you need.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Link href="/#listings" className="btn-ghost">
                      Clear search
                    </Link>
                    <Link href="/requests/new" className="btn-primary">
                      Post a custom request
                    </Link>
                  </div>
                </div>
              ) : (
                // Brand-new marketplace — invite both sides honestly.
                <div className="glass rounded-3xl p-10 text-center md:p-14">
                  <p className="eyebrow">Just launched</p>
                  <h3 className="mt-3 text-2xl font-bold text-white">The first listings are on their way.</h3>
                  <p className="text-muted mx-auto mt-3 max-w-lg text-sm">
                    Built something with AI? List it in about a minute — the AI writes the listing from your
                    repo or demo URL. Looking to buy? Post what you need and developers will send offers.
                  </p>
                  <div className="mt-7 flex flex-wrap justify-center gap-3">
                    <Link href="/listings/new" className="btn-primary">
                      Become a founding seller →
                    </Link>
                    <Link href="/requests/new" className="btn-ghost">
                      Post a custom request
                    </Link>
                  </div>
                </div>
              )}
            </Reveal>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l, i) => (
                <Reveal key={l.id} delay={(i % 3) * 0.08} className="h-full">
                  <ListingCard
                    listing={{
                      id: l.id,
                      title: l.title,
                      tagline: l.tagline,
                      category: l.category,
                      priceCents: l.priceCents,
                      verificationStatus: l.verificationStatus,
                      aiQualityScore: l.aiQualityScore,
                      sellerName: l.seller.name,
                    }}
                  />
                </Reveal>
              ))}
            </div>
          )}
        </section>

        {/* ================================================================
         * 4. MARQUEE of real categories / tech stacks
         * ============================================================== */}
        {tags.length > 0 && (
          <section className="mt-20 space-y-4">
            <Marquee
              duration={45}
              items={tags.map((t) => (
                <span key={t} className="chip !px-4 !py-2 !text-xs">
                  {t}
                </span>
              ))}
            />
            <Marquee
              duration={55}
              reverse
              items={[...tags].reverse().map((t) => (
                <span key={t} className="font-[family-name:var(--font-display)] text-2xl font-semibold text-white/15">
                  {t} <span className="text-gradient">✦</span>
                </span>
              ))}
            />
          </section>
        )}

        {/* ================================================================
         * 5. HOW IT WORKS
         * ============================================================== */}
        <section id="how-it-works" className="mx-auto mt-28 max-w-6xl scroll-mt-28 px-4">
          <Reveal>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 max-w-2xl text-4xl font-bold text-white md:text-5xl">
              Trust, <span className="text-gradient">automated</span> end to end.
            </h2>
          </Reveal>
          <div className="relative mt-12 grid gap-6 md:grid-cols-3">
            {/* Energy beam connecting the steps (desktop). */}
            <div aria-hidden className="animate-beam absolute left-[8%] right-[8%] top-12 hidden h-px md:block" />
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.12}>
                <SpotlightCard glow={s.glow} className="h-full">
                  <div className="p-7">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-[#0b0c1d] font-mono text-sm font-bold text-white"
                      style={{ boxShadow: `0 0 30px -4px rgba(${s.glow},0.8)` }}
                    >
                      {s.n}
                    </div>
                    <h3 className="mt-6 text-xl font-semibold text-white">{s.title}</h3>
                    <p className="text-muted mt-2 text-sm leading-relaxed">{s.body}</p>
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ================================================================
         * 6. TWO-SIDED CTA
         * ============================================================== */}
        <section className="mx-auto mt-32 max-w-6xl px-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Reveal>
              <SpotlightCard glow="139,92,246" className="h-full">
                <div className="relative overflow-hidden p-10">
                  <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-violet-600/30 blur-3xl" />
                  <p className="eyebrow">For makers</p>
                  <h3 className="mt-4 text-3xl font-bold text-white">
                    Built something with AI? <span className="text-gradient">Sell it.</span>
                  </h3>
                  <p className="text-muted mt-3 text-sm">
                    Turn side projects into a payout. AI writes the listing, an
                    agent verifies it, PayPal pays you your share instantly.
                  </p>
                  <Link href="/listings/new" className="btn-primary mt-8">
                    Start selling →
                  </Link>
                </div>
              </SpotlightCard>
            </Reveal>
            <Reveal delay={0.12}>
              <SpotlightCard glow="34,211,238" className="h-full">
                <div className="relative overflow-hidden p-10">
                  <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-500/25 blur-3xl" />
                  <p className="eyebrow">For buyers</p>
                  <h3 className="mt-4 text-3xl font-bold text-white">
                    Skip the build. <span className="text-gradient">Own the business.</span>
                  </h3>
                  <p className="text-muted mt-3 text-sm">
                    Acquire verified apps with code, brand and docs — or post a
                    brief and get it built with your money safe in PayPal escrow.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link href="#listings" className="btn-primary">
                      Browse apps
                    </Link>
                    <Link href="/requests/new" className="btn-ghost">
                      Post a request
                    </Link>
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
