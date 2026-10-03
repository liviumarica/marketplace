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
  searchParams: Promise<{ q?: string }>;
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
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  // Search order: real Elastic hybrid (kNN + BM25) when reachable, plain SQL
  // LIKE otherwise. Both paths return real listing rows — never fixtures.
  let listings;
  if (query) {
    const hits = await searchListingsSemantic(query);
    if (hits && hits.length > 0) {
      const rows = await prisma.listing.findMany({
        where: { id: { in: hits.map((h) => h.id) }, status: "ACTIVE" },
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
      where: { status: "ACTIVE" },
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
    // Top listings power the 3D holograms + the marquee.
    prisma.listing.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ aiQualityScore: "desc" }, { createdAt: "desc" }],
      select: {
        title: true,
        priceCents: true,
        category: true,
        techStack: true,
        verificationStatus: true,
      },
    }),
  ]);

  // Holographic cards orbiting the 3D core (max 8 for legibility).
  const heroCards = catalogue.slice(0, 8).map((l) => ({
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
    { label: "Apps for sale", value: activeCount, format: "int" as const },
    { label: "AI-verified", value: verifiedCount, format: "int" as const },
    { label: "Paid through PayPal", value: paidVolume._sum.totalCents ?? 0, format: "usd" as const },
    { label: "Open custom builds", value: openRequests, format: "int" as const },
  ];

  return (
    <PageTransition>
      <div>
        {/* ================================================================
         * 1. HERO
         * ============================================================== */}
        <section className="relative -mt-24 flex min-h-[100svh] items-center overflow-hidden pt-24">
          {/* Perspective grid floor glowing at the horizon. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] opacity-50">
            <div className="grid-floor absolute inset-x-[-50%] top-0 h-[200%]" />
          </div>

          {/* 3D scene — right half on desktop, dimmed backdrop on mobile. */}
          <div className="absolute inset-0 opacity-40 lg:left-[38%] lg:opacity-100">
            <HeroSceneLazy cards={heroCards} />
          </div>

          <div className="relative mx-auto w-full max-w-6xl px-4">
            <div className="max-w-2xl">
              <Reveal>
                <span className="chip chip-violet">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-cyan-300" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
                  </span>
                  {activeCount} AI-built businesses live right now
                </span>
              </Reveal>

              <h1 className="mt-6 text-5xl font-bold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
                <SplitText text="Buy an AI-built business." />
                <br />
                <SplitText
                  text="Or have one built."
                  wordClassName="text-gradient"
                  delay={0.35}
                />
              </h1>

              <Reveal delay={0.6}>
                <p className="text-muted mt-6 max-w-xl text-lg">
                  Every listing is verified by an AI agent that actually runs the
                  app. Payments split automatically between seller and platform
                  via PayPal.
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
                <div className="mt-6 flex flex-wrap items-center gap-3">
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

          {/* Scroll hint. */}
          <div aria-hidden className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40 md:flex">
            Scroll
            <span className="h-10 w-px overflow-hidden bg-white/10">
              <span className="block h-1/2 w-px animate-[scan_1.8s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-cyan-300 to-transparent" />
            </span>
          </div>
        </section>

        {/* ================================================================
         * 2. LIVE STATS (real aggregates)
         * ============================================================== */}
        <section className="relative mx-auto -mt-10 max-w-6xl px-4">
          <Reveal>
            <div className="glass-strong grid grid-cols-2 divide-white/10 rounded-3xl md:grid-cols-4 md:divide-x">
              {stats.map((s) => (
                <div key={s.label} className="px-6 py-7 text-center">
                  <AnimatedCounter
                    value={s.value}
                    format={s.format}
                    className="text-gradient-soft font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl"
                  />
                  <p className="text-dim mt-1 text-xs uppercase tracking-[0.18em]">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ================================================================
         * 3. MARQUEE of real categories / tech stacks
         * ============================================================== */}
        {tags.length > 0 && (
          <section className="mt-16 space-y-4">
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
         * 4. HOW IT WORKS
         * ============================================================== */}
        <section className="mx-auto mt-28 max-w-6xl px-4">
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
         * 5. LISTINGS GRID
         * ============================================================== */}
        <section id="listings" className="mx-auto mt-28 max-w-6xl px-4">
          <Reveal>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">{query ? "Search results" : "Marketplace"}</p>
                <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">
                  {query ? (
                    <>
                      Results for <span className="text-gradient">“{query}”</span>
                    </>
                  ) : (
                    "SaaS businesses for sale"
                  )}
                </h2>
              </div>
              <span className="chip">
                {listings.length} listing{listings.length === 1 ? "" : "s"}
              </span>
            </div>
          </Reveal>

          {listings.length === 0 ? (
            <Reveal>
              <div className="glass rounded-3xl p-14 text-center">
                <p className="text-muted">No listings yet.</p>
                <Link href="/listings/new" className="btn-primary mt-5">
                  List the first AI-built app
                </Link>
              </div>
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
