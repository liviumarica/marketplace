/**
 * Escrow workspace — the shared page for a funded custom order.
 * Shows the escrow state machine, lets the developer deliver, and lets the
 * buyer accept (capture) or dispute (void) — real PayPal money movement.
 */
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatUsd } from "@/lib/money";
import { DeliverForm } from "@/components/DeliverForm";
import { EscrowActions } from "@/components/EscrowActions";

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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">{order.request.title}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Escrow order {order.id} · {formatUsd(order.amountCents)} (
        {formatUsd(order.amountCents - order.platformFeeCents)} to developer,{" "}
        {formatUsd(order.platformFeeCents)} platform fee)
      </p>

      {/* Escrow progress */}
      <div className="mt-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i <= currentStep
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-xs ${i <= currentStep ? "text-slate-900" : "text-slate-400"}`}
            >
              {s.replace("_", " ")}
            </span>
            {i < STEPS.length - 1 && (
              <div className="h-px flex-1 bg-slate-200" />
            )}
          </div>
        ))}
      </div>
      {(order.status === "DISPUTED" || order.status === "REFUNDED") && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Order {order.status.toLowerCase()} — escrow funds were released back
          to the buyer.
        </p>
      )}

      {/* Parties + payment refs */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <div className="font-semibold">Buyer</div>
          <div className="mt-1 text-slate-600">{buyer?.name}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <div className="font-semibold">Developer</div>
          <div className="mt-1 text-slate-600">
            {order.developer.name} — {order.offer.deliveryDays} days promised
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-4 font-mono text-xs text-slate-600">
        PayPal order: {order.paypalOrderId ?? "—"}
        <br />
        Authorization: {order.paypalAuthorizationId ?? "—"}
      </div>

      {/* Delivery area */}
      {order.deliveryUrl && (
        <section className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <h2 className="text-sm font-semibold text-emerald-900">Delivery</h2>
          <a
            href={order.deliveryUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block text-sm text-indigo-700 underline"
          >
            {order.deliveryUrl}
          </a>
          {order.deliveryNotes && (
            <p className="mt-2 text-sm text-slate-700">{order.deliveryNotes}</p>
          )}
          {order.autoReleaseAt && order.status === "DELIVERED" && (
            <p className="mt-2 text-xs text-amber-700">
              Auto-release:{" "}
              {new Date(order.autoReleaseAt).toLocaleDateString()} — funds go
              to the developer if the buyer doesn&apos;t respond.
            </p>
          )}
        </section>
      )}

      {/* Actions */}
      {isDev && order.status === "FUNDED" && (
        <DeliverForm orderId={order.id} />
      )}
      {isBuyer && order.status === "DELIVERED" && (
        <EscrowActions orderId={order.id} />
      )}
      {isDev && order.status === "DELIVERED" && (
        <p className="mt-6 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Delivered — waiting for the buyer to review and release the escrow.
        </p>
      )}
      {order.status === "COMPLETED" && (
        <p className="mt-6 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Escrow released — {formatUsd(order.amountCents - order.platformFeeCents)}{" "}
          paid to the developer, {formatUsd(order.platformFeeCents)} platform
          commission retained.
        </p>
      )}
    </div>
  );
}
