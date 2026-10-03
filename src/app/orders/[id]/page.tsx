/**
 * Order page — shown after a successful purchase and accessible to both
 * parties. The buyer sees the acquired assets (repo, transfer checklist);
 * the seller sees sale confirmation and payout details.
 *
 * Design: a celebratory glass receipt with a glowing success badge,
 * animated money-split bar and a step-by-step transfer checklist.
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatUsd } from "@/lib/money";
import { PageTransition } from "@/components/fx/PageTransition";
import { Reveal } from "@/components/fx/Reveal";
import { SuccessBurst } from "@/components/fx/SuccessBurst";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      listing: true,
      buyer: { select: { name: true, email: true } },
      seller: { select: { name: true, paypalEmail: true } },
    },
  });
  if (!order) notFound();
  if (order.buyerId !== user.id && order.sellerId !== user.id && user.role !== "ADMIN") {
    notFound();
  }

  const isBuyer = order.buyerId === user.id;
  const paid = order.status === "PAID";
  // Seller share as a percentage of the total (for the split bar).
  const sellerPct = order.totalCents > 0 ? (order.sellerAmountCents / order.totalCents) * 100 : 100;

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="neon-border relative overflow-hidden rounded-3xl p-8 md:p-10 shadow-[0_0_100px_-30px_rgba(52,211,153,0.7)]">
          <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />

          <div className="relative flex flex-wrap items-center gap-5">
            {paid ? (
              <SuccessBurst />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/40 bg-amber-300/10 text-2xl text-amber-200">
                …
              </span>
            )}
            <div>
              <p className="eyebrow">{paid ? "Payment captured" : "Order status"}</p>
              <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">
                {paid
                  ? isBuyer
                    ? "Purchase complete"
                    : "Your app was sold"
                  : `Order ${order.status.toLowerCase()}`}
              </h1>
              <p className="text-dim mt-1 font-mono text-xs">Order {order.id}</p>
            </div>
          </div>

          {/* Payment breakdown */}
          <Reveal delay={0.2}>
            <section className="relative mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="eyebrow">Payment breakdown</h2>
              <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${sellerPct}%` }} />
                <div className="h-full flex-1 bg-fuchsia-400/70" />
              </div>
              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between text-white">
                  <dt>Total paid by {order.buyer.name}</dt>
                  <dd className="font-mono font-bold">{formatUsd(order.totalCents)}</dd>
                </div>
                <div className="flex justify-between text-white/70">
                  <dt className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    Seller share (to {order.seller.name})
                  </dt>
                  <dd className="font-mono">{formatUsd(order.sellerAmountCents)}</dd>
                </div>
                <div className="flex justify-between text-white/70">
                  <dt className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-fuchsia-400" />
                    Platform commission
                  </dt>
                  <dd className="font-mono">{formatUsd(order.platformFeeCents)}</dd>
                </div>
              </dl>
              <p className="text-dim mt-4 break-all font-mono text-[11px]">
                PayPal order: {order.paypalOrderId}
                {order.paypalCaptureId ? ` · capture: ${order.paypalCaptureId}` : ""}
              </p>
            </section>
          </Reveal>

          {/* Asset transfer — only the buyer sees the acquired assets */}
          {paid && isBuyer && (
            <Reveal delay={0.3}>
              <section className="relative mt-6 rounded-2xl border border-violet-400/30 bg-violet-500/[0.06] p-6">
                <h2 className="eyebrow !text-violet-300">Your acquired assets</h2>
                <ul className="mt-4 space-y-3 text-sm text-white/80">
                  {order.listing.repoUrl && (
                    <li>
                      <strong className="text-white">Source code:</strong>{" "}
                      <a href={order.listing.repoUrl} target="_blank" rel="noreferrer" className="link-neon break-all">
                        {order.listing.repoUrl}
                      </a>{" "}
                      — request collaborator access from {order.seller.name} if the
                      repo is private.
                    </li>
                  )}
                  {order.listing.demoUrl && (
                    <li>
                      <strong className="text-white">Live deployment:</strong>{" "}
                      <a href={order.listing.demoUrl} target="_blank" rel="noreferrer" className="link-neon break-all">
                        {order.listing.demoUrl}
                      </a>{" "}
                      — coordinate hosting/domain transfer with the seller.
                    </li>
                  )}
                  <li>
                    <strong className="text-white">Brand &amp; docs:</strong> included per listing
                    description — the seller transfers all associated materials.
                  </li>
                </ul>
                <h3 className="mt-6 text-sm font-semibold text-white">Transfer checklist</h3>
                <ol className="mt-3 space-y-2 text-sm">
                  {[
                    "Get repository access / source archive from the seller",
                    "Transfer domain + hosting credentials",
                    "Rotate API keys and secrets",
                    "Confirm everything works, then close the transfer",
                  ].map((step, i) => (
                    <Reveal key={step} as="li" delay={0.35 + i * 0.07} y={10}>
                      <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-white/80">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 font-mono text-[11px] font-bold text-white">
                          {i + 1}
                        </span>
                        {step}
                      </div>
                    </Reveal>
                  ))}
                </ol>
              </section>
            </Reveal>
          )}

          {paid && !isBuyer && (
            <Reveal delay={0.3}>
              <section className="alert-success relative mt-6 !p-5">
                <p>
                  <strong>Next steps:</strong> transfer the repository, domain and
                  docs to {order.buyer.name} ({order.buyer.email}). Your share of{" "}
                  {formatUsd(order.sellerAmountCents)} was paid to{" "}
                  {order.seller.paypalEmail ?? "your PayPal account"}.
                </p>
              </section>
            </Reveal>
          )}

          <div className="relative mt-8 flex flex-wrap gap-3">
            <Link href="/" className="btn-ghost">
              Back to marketplace
            </Link>
            <Link href="/dashboard" className="btn-primary">
              Go to dashboard →
            </Link>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
