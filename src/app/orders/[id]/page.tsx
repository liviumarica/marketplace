/**
 * Order page — shown after a successful purchase and accessible to both
 * parties. The buyer sees the acquired assets (repo, transfer checklist);
 * the seller sees sale confirmation and payout details.
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatUsd } from "@/lib/money";

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            ✓
          </span>
          <div>
            <h1 className="text-2xl font-bold">
              {order.status === "PAID"
                ? isBuyer
                  ? "Purchase complete"
                  : "Your app was sold"
                : `Order ${order.status.toLowerCase()}`}
            </h1>
            <p className="text-sm text-slate-500">Order {order.id}</p>
          </div>
        </div>

        {/* Payment breakdown */}
        <section className="mt-6 rounded-lg bg-slate-50 p-4">
          <h2 className="text-sm font-semibold">Payment breakdown</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Total paid by {order.buyer.name}</dt>
              <dd className="font-medium">{formatUsd(order.totalCents)}</dd>
            </div>
            <div className="flex justify-between text-slate-600">
              <dt>Seller share (to {order.seller.name})</dt>
              <dd>{formatUsd(order.sellerAmountCents)}</dd>
            </div>
            <div className="flex justify-between text-slate-600">
              <dt>Platform commission</dt>
              <dd>{formatUsd(order.platformFeeCents)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-slate-500">
            PayPal order: {order.paypalOrderId}
            {order.paypalCaptureId ? ` · capture: ${order.paypalCaptureId}` : ""}
          </p>
        </section>

        {/* Asset transfer — only the buyer sees the acquired assets */}
        {order.status === "PAID" && isBuyer && (
          <section className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
            <h2 className="text-sm font-semibold text-indigo-900">
              Your acquired assets
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {order.listing.repoUrl && (
                <li>
                  <strong>Source code:</strong>{" "}
                  <a
                    href={order.listing.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-700 underline"
                  >
                    {order.listing.repoUrl}
                  </a>{" "}
                  — request collaborator access from {order.seller.name} if the
                  repo is private.
                </li>
              )}
              {order.listing.demoUrl && (
                <li>
                  <strong>Live deployment:</strong>{" "}
                  <a
                    href={order.listing.demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-700 underline"
                  >
                    {order.listing.demoUrl}
                  </a>{" "}
                  — coordinate hosting/domain transfer with the seller.
                </li>
              )}
              <li>
                <strong>Brand &amp; docs:</strong> included per listing
                description — the seller transfers all associated materials.
              </li>
            </ul>
            <h3 className="mt-4 text-sm font-semibold text-indigo-900">
              Transfer checklist
            </h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-indigo-900">
              <li>Get repository access / source archive from the seller</li>
              <li>Transfer domain + hosting credentials</li>
              <li>Rotate API keys and secrets</li>
              <li>Confirm everything works, then close the transfer</li>
            </ol>
          </section>
        )}

        {order.status === "PAID" && !isBuyer && (
          <section className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-sm text-emerald-900">
            <p>
              <strong>Next steps:</strong> transfer the repository, domain and
              docs to {order.buyer.name} ({order.buyer.email}). Your share of{" "}
              {formatUsd(order.sellerAmountCents)} was paid to{" "}
              {order.seller.paypalEmail ?? "your PayPal account"}.
            </p>
          </section>
        )}

        <div className="mt-6 flex gap-3">
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Back to marketplace
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
