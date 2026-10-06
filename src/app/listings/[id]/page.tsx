/**
 * Listing detail page — everything a buyer needs to evaluate the SaaS
 * business: description, features, tech stack, AI verification report,
 * price benchmark, demo booking and the real PayPal checkout.
 *
 * Design: cinematic category-tinted header (the title morphs in from the
 * browse card via a shared <ViewTransition>), glass content panels that
 * reveal on scroll, an animated AI score ring and a sticky neon purchase box.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { ViewTransition } from "react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatUsd, platformFee } from "@/lib/money";
import { env } from "@/lib/env";
import { hueFor } from "@/lib/hue";
import { isPayoutReady, missingPayoutField, SELLER_NOT_PAYOUT_READY } from "@/lib/payout";
import { BuyWithPayPal } from "@/components/BuyWithPayPal";
import { DemoScheduler } from "@/components/DemoScheduler";
import { VerificationPanel } from "@/components/VerificationPanel";
import { listingStatusLabel, toneClass } from "@/lib/listing-status";
import { PriceBenchmark } from "@/components/PriceBenchmark";
import { PageTransition } from "@/components/fx/PageTransition";
import { Reveal } from "@/components/fx/Reveal";
import { ScoreRing } from "@/components/fx/ScoreRing";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getSessionUser();

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      // PayPal fields are read server-side only, to decide if checkout is possible.
      seller: {
        select: { id: true, name: true, createdAt: true, paypalEmail: true, paypalMerchantId: true },
      },
      verificationRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!listing || (listing.status === "DRAFT" && listing.sellerId !== user?.id)) {
    notFound();
  }

  // Count a real view — simple marketplace metric.
  await prisma.listing.update({
    where: { id: listing.id },
    data: { views: { increment: 1 } },
  });

  const techStack: string[] = JSON.parse(listing.techStack || "[]");
  const features: string[] = JSON.parse(listing.features || "[]");
  const feeCents = platformFee(listing.priceCents, env.platformFeeBps);
  const latestRun = listing.verificationRuns[0];
  const report = latestRun?.report ? JSON.parse(latestRun.report) : null;
  const isOwner = user?.id === listing.sellerId;
  const canBuy = listing.status === "ACTIVE" && !isOwner;
  // Sellers can publish before adding PayPal; checkout waits until they do.
  const sellerPayoutReady = isPayoutReady(listing.seller);
  const hue = hueFor(listing.category);
  // Share of the price that goes to the seller (for the split bar).
  const sellerPct =
    listing.priceCents > 0
      ? Math.round(((listing.priceCents - feeCents) / listing.priceCents) * 100)
      : 100;

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Back link to the browse grid. */}
        <Link href="/" className="text-dim text-sm transition-colors hover:text-white">
          ← Back to marketplace
        </Link>

        {/* ——— Cinematic header ——— */}
        <header className="glass-strong relative mt-4 overflow-hidden rounded-3xl p-8 md:p-12">
          <div
            aria-hidden
            className="absolute inset-0 opacity-70"
            style={{
              background: `radial-gradient(circle at 10% 0%, hsla(${hue},90%,60%,0.45), transparent 50%),
                           radial-gradient(circle at 90% 100%, hsla(${(hue + 70) % 360},90%,55%,0.35), transparent 55%)`,
            }}
          />
          <div aria-hidden className="dot-bg absolute inset-0 opacity-40" />
          <div className="relative flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip chip-violet">{listing.category}</span>
                {listing.verificationStatus === "PASSED" && (
                  <span className="chip chip-green">✓ AI Verified {listing.aiQualityScore}/100</span>
                )}
                {listing.verificationStatus === "RUNNING" && (
                  <span className="chip chip-amber">
                    <span className="h-2 w-2 animate-spin rounded-full border border-amber-200 border-t-transparent" />
                    AI verification in progress…
                  </span>
                )}
                {(() => {
                  const s = listingStatusLabel(listing.status);
                  return (
                    <span className={`chip ${toneClass(s.tone)}`} title={s.hint}>
                      {s.label}
                    </span>
                  );
                })()}
              </div>

              <ViewTransition name={`listing-title-${listing.id}`} share="morph" default="none">
                <h1 className="mt-5 text-4xl font-bold text-white md:text-6xl">{listing.title}</h1>
              </ViewTransition>
              {listing.tagline && (
                <p className="text-muted mt-3 text-lg md:text-xl">{listing.tagline}</p>
              )}
              <p className="text-dim mt-4 text-sm">
                Sold by <span className="text-white/80">{listing.seller.name}</span> ·{" "}
                {listing.views} views
              </p>
            </div>
            {listing.aiQualityScore != null && (
              <div className="flex flex-col items-center gap-2">
                <ScoreRing score={listing.aiQualityScore} size={120} stroke={9} />
                <span className="eyebrow !text-[10px]">AI quality</span>
              </div>
            )}
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {/* ——— Main column ——— */}
          <div className="space-y-6 lg:col-span-2">
            <Reveal>
              <section className="glass rounded-2xl p-7">
                <p className="eyebrow">About the business</p>
                <div className="mt-4 whitespace-pre-wrap leading-relaxed text-white/80">
                  {listing.description}
                </div>
              </section>
            </Reveal>

            {features.length > 0 && (
              <Reveal>
                <section>
                  <h2 className="text-xl font-semibold text-white">Features</h2>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {features.map((f, i) => (
                      <Reveal key={f} as="li" delay={i * 0.05} y={14}>
                        <div className="glass flex items-start gap-3 rounded-xl px-4 py-3 text-sm text-white/85 transition hover:border-cyan-300/40">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-xs text-emerald-300">
                            ✓
                          </span>
                          {f}
                        </div>
                      </Reveal>
                    ))}
                  </ul>
                </section>
              </Reveal>
            )}

            {techStack.length > 0 && (
              <Reveal>
                <section>
                  <h2 className="text-xl font-semibold text-white">Tech stack</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {techStack.map((t) => (
                      <span key={t} className="chip chip-cyan !px-3 !py-1.5 font-mono">
                        {t}
                      </span>
                    ))}
                  </div>
                </section>
              </Reveal>
            )}

            {/* AI verification report */}
            {report && (
              <Reveal>
                <section className="relative overflow-hidden rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.04] p-7">
                  {/* Scan-line sweeping across the report — "agent at work". */}
                  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="h-1/3 w-full animate-[scan_5s_linear_infinite] bg-gradient-to-b from-transparent via-emerald-300/10 to-transparent" />
                  </div>
                  <div className="relative flex flex-wrap items-center justify-between gap-6">
                    <div className="max-w-md">
                      <p className="eyebrow !text-emerald-300">AI verification report</p>
                      <p className="text-muted mt-3 text-sm">
                        An autonomous agent ran this app in a cloud browser (KERNEL)
                        and scored it {latestRun?.qualityScore ?? "-"}/100.
                      </p>
                    </div>
                    {latestRun?.qualityScore != null && (
                      <ScoreRing score={latestRun.qualityScore} size={84} stroke={7} />
                    )}
                  </div>
                  <ul className="relative mt-5 space-y-2 text-sm">
                    {(report.checks ?? []).map(
                      (c: { name: string; passed: boolean; note?: string }, i: number) => (
                        <Reveal key={c.name} as="li" delay={i * 0.06} y={10}>
                          <div className="flex items-start gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
                            <span
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                                c.passed ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-400/20 text-rose-300"
                              }`}
                            >
                              {c.passed ? "✓" : "✕"}
                            </span>
                            <span className="text-white/80">
                              <strong className="text-white">{c.name}</strong>
                              {c.note ? ` — ${c.note}` : ""}
                            </span>
                          </div>
                        </Reveal>
                      ),
                    )}
                  </ul>
                  {report.summary && (
                    <p className="text-muted relative mt-5 border-l-2 border-emerald-300/40 pl-4 text-sm italic">
                      “{report.summary}”
                    </p>
                  )}
                </section>
              </Reveal>
            )}

            {/* Market price benchmark via Channel3 */}
            <PriceBenchmark
              title={listing.title}
              category={listing.category}
              askingCents={listing.priceCents}
            />
          </div>

          {/* ——— Sidebar: purchase box ——— */}
          <aside className="lg:col-span-1">
            <div className="neon-border sticky top-24 rounded-3xl p-7 shadow-[0_0_80px_-20px_rgba(139,92,246,0.7)]">
              <p className="eyebrow">Acquire</p>
              <div className="mt-3 font-mono text-4xl font-bold text-white">
                {formatUsd(listing.priceCents)}
              </div>
              <p className="text-dim mt-1 text-sm">
                One-time acquisition — source code, brand &amp; docs included
              </p>

              {/* Visual split of where the money goes. */}
              <div className="mt-6">
                <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-cyan-400"
                    style={{ width: `${sellerPct}%` }}
                  />
                  <div className="h-full flex-1 bg-fuchsia-400/70" />
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-white/70">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" /> Seller receives
                    </span>
                    <span className="font-mono">{formatUsd(listing.priceCents - feeCents)}</span>
                  </div>
                  <div className="flex justify-between text-white/70">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-fuchsia-400" /> Platform fee (
                      {env.platformFeeBps / 100}%)
                    </span>
                    <span className="font-mono">{formatUsd(feeCents)}</span>
                  </div>
                </div>
              </div>

              {listing.demoUrl && (
                <a
                  href={listing.demoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost mt-6 w-full"
                >
                  Try live demo ↗
                </a>
              )}

              <div className="mt-4">
                {canBuy ? (
                  !user ? (
                    <Link href="/login" className="btn-primary w-full">
                      Log in to buy
                    </Link>
                  ) : !sellerPayoutReady ? (
                    <p className="alert-info text-center">{SELLER_NOT_PAYOUT_READY}</p>
                  ) : !user.emailVerifiedAt ? (
                    <p className="alert-info text-center">
                      Verify your email to buy — use the link we sent you, or resend it from the reminder at the bottom of the page.
                    </p>
                  ) : (
                    <BuyWithPayPal
                      listingId={listing.id}
                      priceLabel={formatUsd(listing.priceCents)}
                      paypalClientId={env.paypalClientId}
                    />
                  )
                ) : isOwner ? (
                  <div className="space-y-3">
                    <p className="alert-info text-center">This is your listing</p>
                    {/* Owner-only: what AI verification is + start / retry. */}
                    <VerificationPanel
                      listingId={listing.id}
                      status={listing.verificationStatus}
                      score={listing.aiQualityScore}
                      hasDemoUrl={Boolean(listing.demoUrl)}
                      enabled={Boolean(env.kernelApiKey)}
                    />
                    {/* Nudge the owner to finish payout setup so buyers can pay. */}
                    {!sellerPayoutReady && listing.status !== "SOLD" && (
                      <p className="alert-error text-center text-sm">
                        Buyers can&apos;t check out yet — add your {missingPayoutField()} in{" "}
                        <Link href="/settings#payouts" className="link-neon">
                          Settings
                        </Link>
                        .
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="alert-info text-center">
                    {listing.status === "SOLD" ? "Sold" : "Not available for purchase yet"}
                  </p>
                )}
              </div>

              {/* Demo booking with the seller — Bryntum scheduler */}
              {!isOwner && listing.status === "ACTIVE" && user && (
                <DemoScheduler listingId={listing.id} />
              )}
            </div>
          </aside>
        </div>
      </div>
    </PageTransition>
  );
}
