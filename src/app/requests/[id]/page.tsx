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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{request.title}</h1>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {request.status.replace("_", " ")}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        by {request.buyer.name} · budget {formatUsd(request.budgetCents)} ·
        deadline {request.deadlineDays} days
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold">Brief</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
              {request.brief}
            </p>
          </section>

          {request.refinedBrief && (
            <section className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-6">
              <h2 className="font-semibold text-indigo-900">
                AI-refined spec
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-indigo-900">
                {request.refinedBrief}
              </p>
            </section>
          )}

          {/* Offer form for developers */}
          {canOffer && <OfferForm requestId={request.id} />}
          {!user && (
            <Link
              href="/login"
              className="block rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-indigo-600"
            >
              Log in to make an offer
            </Link>
          )}
        </div>

        {/* Offers column */}
        <aside>
          <h2 className="font-semibold">
            Offers ({request.offers.length})
          </h2>
          <div className="mt-3 space-y-3">
            {request.offers.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                No offers yet.
              </p>
            )}
            {request.offers.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{o.developer.name}</span>
                  <span className="font-semibold">
                    {formatUsd(o.priceCents)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  delivers in {o.deliveryDays} days ·{" "}
                  <span
                    className={
                      o.status === "ACCEPTED"
                        ? "text-emerald-600"
                        : o.status === "DECLINED"
                          ? "text-slate-400"
                          : "text-amber-600"
                    }
                  >
                    {o.status}
                  </span>
                </p>
                <p className="mt-2 text-sm text-slate-600">{o.message}</p>

                {/* Buyer accepts the offer → fund escrow via PayPal authorize */}
                {isOwner && o.status === "PENDING" && request.status === "OPEN" && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <FundEscrowButton
                      offerId={o.id}
                      paypalClientId={env.paypalClientId}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {request.order && (
            <Link
              href={`/custom-orders/${request.order.id}`}
              className="mt-4 block rounded-md bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-700"
            >
              Open escrow workspace →
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
