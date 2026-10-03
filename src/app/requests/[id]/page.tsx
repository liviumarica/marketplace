/**
 * Custom request detail — shows the brief (+ AI-refined spec), the offers
 * from developers, an offer form for sellers, and the escrow-funding PayPal
 * button when the buyer accepts an offer.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatUsd } from "@/lib/money";
import { env } from "@/lib/env";
import { OfferForm } from "@/components/OfferForm";
import { FundEscrowButton } from "@/components/FundEscrowButton";
import { PageTransition } from "@/components/fx/PageTransition";
import { Reveal } from "@/components/fx/Reveal";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RequestDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getSessionUser();

  const request = await prisma.customRequest.findUnique({
    where: { id },
    include: {
      buyer: { select: { id: true, name: true } },
      offers: {
        orderBy: { priceCents: "asc" },
        include: { developer: { select: { id: true, name: true, bio: true } } },
      },
      order: true,
    },
  });
  if (!request) notFound();

  const isOwner = user?.id === request.buyerId;
  const canOffer =
    !!user &&
    !isOwner &&
    request.status === "OPEN" &&
    !request.offers.some((o) => o.developerId === user.id && o.status === "PENDING");

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Link href="/requests" className="text-dim text-sm transition-colors hover:text-white">
          ← All custom builds
        </Link>

        {/* Header */}
        <Reveal>
          <header className="glass-strong relative mt-4 overflow-hidden rounded-3xl p-8 md:p-10">
            <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-3">
                <span className="chip chip-cyan">{request.status.replace("_", " ")}</span>
                {request.category && <span className="chip">{request.category}</span>}
              </div>
              <h1 className="mt-4 text-3xl font-bold text-white md:text-5xl">{request.title}</h1>
              <div className="mt-6 flex flex-wrap gap-8 text-sm">
                <div>
                  <p className="text-dim text-xs uppercase tracking-widest">Budget</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-white">
                    {formatUsd(request.budgetCents)}
                  </p>
                </div>
                <div>
                  <p className="text-dim text-xs uppercase tracking-widest">Deadline</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-white">
                    {request.deadlineDays}d
                  </p>
                </div>
                <div>
                  <p className="text-dim text-xs uppercase tracking-widest">Posted by</p>
                  <p className="mt-1 text-lg font-semibold text-white">{request.buyer.name}</p>
                </div>
              </div>
            </div>
          </header>
        </Reveal>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Reveal>
              <section className="glass rounded-2xl p-7">
                <p className="eyebrow">Brief</p>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                  {request.brief}
                </p>
              </section>
            </Reveal>

            {request.refinedBrief && (
              <Reveal>
                <section className="relative overflow-hidden rounded-2xl border border-violet-400/30 bg-violet-500/[0.06] p-7">
                  <p className="eyebrow !text-violet-300">✦ AI-refined spec</p>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/85">
                    {request.refinedBrief}
                  </p>
                </section>
              </Reveal>
            )}

            {/* Offer form for developers */}
            {canOffer && (
              <Reveal>
                <OfferForm requestId={request.id} />
              </Reveal>
            )}
            {!user && (
              <Link href="/login" className="btn-ghost w-full !py-5">
                Log in to make an offer
              </Link>
            )}
          </div>

          {/* Offers column */}
          <aside>
            <h2 className="flex items-center gap-3 text-xl font-semibold text-white">
              Offers
              <span className="chip">{request.offers.length}</span>
            </h2>
            <div className="mt-4 space-y-3">
              {request.offers.length === 0 && (
                <p className="glass text-dim rounded-2xl p-5 text-sm">No offers yet.</p>
              )}
              {request.offers.map((o, i) => (
                <Reveal key={o.id} delay={i * 0.08}>
                  <div className="glass rounded-2xl p-5 transition hover:border-violet-400/40">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex items-center gap-2 font-medium text-white">
                        {/* Avatar with the developer's initial. */}
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-xs font-bold">
                          {o.developer.name.slice(0, 1)}
                        </span>
                        {o.developer.name}
                      </span>
                      <span className="font-mono text-lg font-bold text-white">
                        {formatUsd(o.priceCents)}
                      </span>
                    </div>
                    <p className="text-dim mt-2 text-xs">
                      delivers in {o.deliveryDays} days ·{" "}
                      <span
                        className={
                          o.status === "ACCEPTED"
                            ? "text-emerald-300"
                            : o.status === "DECLINED"
                              ? "text-white/30"
                              : "text-amber-300"
                        }
                      >
                        {o.status}
                      </span>
                    </p>
                    <p className="text-muted mt-3 text-sm">{o.message}</p>

                    {/* Buyer accepts the offer → fund escrow via PayPal authorize */}
                    {isOwner && o.status === "PENDING" && request.status === "OPEN" && (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        <FundEscrowButton offerId={o.id} paypalClientId={env.paypalClientId} />
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>

            {request.order && (
              <Link href={`/custom-orders/${request.order.id}`} className="btn-primary mt-5 w-full">
                Open escrow workspace →
              </Link>
            )}
          </aside>
        </div>
      </div>
    </PageTransition>
  );
}
