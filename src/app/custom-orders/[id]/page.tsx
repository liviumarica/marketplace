/**
 * Escrow workspace — the shared page for a funded custom order.
 * Shows the escrow state machine, lets the developer deliver, and lets the
 * buyer accept (capture) or dispute (void) — real PayPal money movement.
 *
 * Design: a neon progress timeline where completed steps glow and the
 * connecting beam "flows" up to the current step.
 */
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatUsd } from "@/lib/money";
import { DeliverForm } from "@/components/DeliverForm";
import { EscrowActions } from "@/components/EscrowActions";
import { PageTransition } from "@/components/fx/PageTransition";
import { PageHeader } from "@/components/fx/PageHeader";
import { Reveal } from "@/components/fx/Reveal";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STEPS = ["PENDING_FUNDING", "FUNDED", "DELIVERED", "COMPLETED"] as const;

export default async function CustomOrderPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const order = await prisma.customOrder.findUnique({
    where: { id },
    include: {
      request: { select: { title: true, brief: true } },
      offer: true,
      developer: { select: { name: true, email: true, paypalEmail: true } },
    },
  });
  if (!order) notFound();
  const isBuyer = order.buyerId === user.id;
  const isDev = order.developerId === user.id;
  if (!isBuyer && !isDev && user.role !== "ADMIN") notFound();

  const buyer = await prisma.user.findUnique({
    where: { id: order.buyerId },
    select: { name: true },
  });

  const currentStep = STEPS.indexOf(
    order.status as (typeof STEPS)[number],
  );

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader
          eyebrow="Escrow workspace"
          title={order.request.title}
          subtitle={
            <>
              <span className="font-mono text-white">{formatUsd(order.amountCents)}</span> in escrow ·{" "}
              {formatUsd(order.amountCents - order.platformFeeCents)} to developer,{" "}
              {formatUsd(order.platformFeeCents)} platform fee
            </>
          }
        />

        {/* Escrow progress timeline */}
        <Reveal delay={0.2}>
          <div className="glass mt-10 rounded-2xl p-6">
            <div className="relative flex items-start justify-between">
              {/* Track + glowing fill up to the current step. */}
              <div aria-hidden className="absolute left-4 right-4 top-4 h-px bg-white/10" />
              <div
                aria-hidden
                className="animate-beam absolute left-4 top-4 h-px"
                style={{
                  width: `calc((100% - 2rem) * ${Math.max(currentStep, 0) / (STEPS.length - 1)})`,
                }}
              />
              {STEPS.map((s, i) => {
                const done = i <= currentStep;
                const current = i === currentStep;
                return (
                  <div key={s} className="relative flex w-20 flex-col items-center gap-2 text-center">
                    <div
                      className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        done
                          ? "bg-gradient-to-br from-emerald-400 to-cyan-400 text-[#05060f] shadow-[0_0_20px_rgba(52,211,153,0.7)]"
                          : "border border-white/15 bg-[#0b0c1d] text-white/40"
                      }`}
                    >
                      {/* Pulsing ring on the active step. */}
                      {current && (
                        <span className="animate-pulse-ring absolute inset-0 rounded-full bg-emerald-300/50" />
                      )}
                      <span className="relative">{done ? "✓" : i + 1}</span>
                    </div>
                    <span className={`text-[11px] uppercase tracking-wider ${done ? "text-white" : "text-white/40"}`}>
                      {s.replace("_", " ")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
        {(order.status === "DISPUTED" || order.status === "REFUNDED") && (
          <p className="alert-error mt-3">
            Order {order.status.toLowerCase()} — escrow funds were released back
            to the buyer.
          </p>
        )}

        {/* Parties + payment refs */}
        <Reveal delay={0.25}>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="glass rounded-2xl p-5 text-sm">
              <div className="eyebrow">Buyer</div>
              <div className="mt-2 text-lg font-semibold text-white">{buyer?.name}</div>
            </div>
            <div className="glass rounded-2xl p-5 text-sm">
              <div className="eyebrow">Developer</div>
              <div className="mt-2 text-lg font-semibold text-white">{order.developer.name}</div>
              <div className="text-dim text-xs">{order.offer.deliveryDays} days promised</div>
            </div>
          </div>
        </Reveal>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-xs text-white/60">
          <span className="text-white/30">$</span> PayPal order: {order.paypalOrderId ?? "—"}
          <br />
          <span className="text-white/30">$</span> Authorization: {order.paypalAuthorizationId ?? "—"}
        </div>

        {/* Delivery area */}
        {order.deliveryUrl && (
          <Reveal>
            <section className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.05] p-6">
              <h2 className="eyebrow !text-emerald-300">Delivery</h2>
              <a href={order.deliveryUrl} target="_blank" rel="noreferrer" className="link-neon mt-3 block break-all text-sm">
                {order.deliveryUrl}
              </a>
              {order.deliveryNotes && (
                <p className="text-muted mt-3 text-sm">{order.deliveryNotes}</p>
              )}
              {order.autoReleaseAt && order.status === "DELIVERED" && (
                <p className="mt-3 text-xs text-amber-300">
                  Auto-release:{" "}
                  {new Date(order.autoReleaseAt).toLocaleDateString()} — funds go
                  to the developer if the buyer doesn&apos;t respond.
                </p>
              )}
            </section>
          </Reveal>
        )}

        {/* Actions */}
        {isDev && order.status === "FUNDED" && <DeliverForm orderId={order.id} />}
        {isBuyer && order.status === "DELIVERED" && <EscrowActions orderId={order.id} />}
        {isDev && order.status === "DELIVERED" && (
          <p className="alert-warn mt-6">
            Delivered — waiting for the buyer to review and release the escrow.
          </p>
        )}
        {order.status === "COMPLETED" && (
          <p className="alert-success mt-6">
            Escrow released — {formatUsd(order.amountCents - order.platformFeeCents)}{" "}
            paid to the developer, {formatUsd(order.platformFeeCents)} platform
            commission retained.
          </p>
        )}
      </div>
    </PageTransition>
  );
}
