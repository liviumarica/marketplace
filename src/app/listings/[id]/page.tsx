/**
 * Listing detail page — everything a buyer needs to evaluate the SaaS
 * business: description, features, tech stack, AI verification report,
 * price benchmark, demo booking and the real PayPal checkout.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatUsd, platformFee } from "@/lib/money";
import { env } from "@/lib/env";
import { BuyWithPayPal } from "@/components/BuyWithPayPal";
import { DemoScheduler } from "@/components/DemoScheduler";
import { PriceBenchmark } from "@/components/PriceBenchmark";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getSessionUser();

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      seller: { select: { id: true, name: true, createdAt: true } },
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* ——— Main column ——— */}
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              {listing.category}
            </span>
            {listing.verificationStatus === "PASSED" && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                ✓ AI Verified {listing.aiQualityScore}/100
              </span>
            )}
            {listing.verificationStatus === "RUNNING" && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                AI verification in progress…
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {listing.status}
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-bold">{listing.title}</h1>
          {listing.tagline && (
            <p className="mt-1 text-lg text-slate-600">{listing.tagline}</p>
          )}
          <p className="mt-2 text-sm text-slate-500">
            Sold by {listing.seller.name} · {listing.views} views
          </p>

          <div className="mt-6 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-6 text-slate-700">
            {listing.description}
          </div>

          {features.length > 0 && (
            <section className="mt-6">
              <h2 className="font-semibold">Features</h2>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="text-emerald-600">✓</span> {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {techStack.length > 0 && (
            <section className="mt-6">
              <h2 className="font-semibold">Tech stack</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {techStack.map((t) => (
                  <span
                    key={t}
                    className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* AI verification report */}
          {report && (
            <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
              <h2 className="font-semibold text-emerald-900">
                AI verification report
              </h2>
              <p className="mt-1 text-sm text-emerald-800">
                An autonomous agent ran this app in a cloud browser (KERNEL)
                and scored it {latestRun?.qualityScore ?? "-"}/100.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {(report.checks ?? []).map(
                  (c: { name: string; passed: boolean; note?: string }) => (
                    <li key={c.name} className="flex items-start gap-2">
                      <span>{c.passed ? "✅" : "❌"}</span>
                      <span>
                        <strong>{c.name}</strong>
                        {c.note ? ` — ${c.note}` : ""}
                      </span>
                    </li>
                  ),
                )}
              </ul>
              {report.summary && (
                <p className="mt-3 text-sm italic text-slate-600">
                  “{report.summary}”
                </p>
              )}
            </section>
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
          <div className="sticky top-20 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-3xl font-bold">
              {formatUsd(listing.priceCents)}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              One-time acquisition — source code, brand &amp; docs included
            </p>

            <div className="mt-4 space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Seller receives</span>
                <span>{formatUsd(listing.priceCents - feeCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform fee ({env.platformFeeBps / 100}%)</span>
                <span>{formatUsd(feeCents)}</span>
              </div>
            </div>

            {listing.demoUrl && (
              <a
                href={listing.demoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium hover:bg-slate-50"
              >
                Try live demo ↗
              </a>
            )}

            <div className="mt-4">
              {canBuy ? (
                user ? (
                  <BuyWithPayPal
                    listingId={listing.id}
                    priceLabel={formatUsd(listing.priceCents)}
                    paypalClientId={env.paypalClientId}
                  />
                ) : (
                  <Link
                    href="/login"
                    className="block rounded-md bg-indigo-600 px-4 py-2.5 text-center font-medium text-white hover:bg-indigo-700"
                  >
                    Log in to buy
                  </Link>
                )
              ) : isOwner ? (
                <p className="rounded-md bg-slate-100 px-3 py-2 text-center text-sm text-slate-600">
                  This is your listing
                </p>
              ) : (
                <p className="rounded-md bg-slate-100 px-3 py-2 text-center text-sm text-slate-600">
                  {listing.status === "SOLD"
                    ? "Sold"
                    : "Not available for purchase yet"}
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
  );
}
