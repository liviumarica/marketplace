/**
 * Dashboard — the seller/admin control room.
 * Stat cards, an AG Grid Enterprise transaction table, and a Bryntum
 * calendar with demo bookings — all fed by real database rows.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatUsd } from "@/lib/money";
import { SalesGrid, type OrderRow } from "@/components/SalesGrid";
import { BookingsCalendar } from "@/components/BookingsCalendar";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";

  // Orders where this user sold (or every order for admins).
  const sales = await prisma.order.findMany({
    where: isAdmin ? {} : { sellerId: user.id },
    include: {
      listing: { select: { title: true } },
      buyer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const purchases = await prisma.order.findMany({
    where: { buyerId: user.id },
    include: {
      listing: { select: { title: true } },
      seller: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const myListings = await prisma.listing.findMany({
    where: { sellerId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const bookings = await prisma.demoBooking.findMany({
    where: {
      OR: [{ buyerId: user.id }, { listing: { sellerId: user.id } }],
    },
    include: { listing: { select: { title: true } }, buyer: { select: { name: true } } },
    orderBy: { startTime: "asc" },
  });
  const myCustomOrders = await prisma.customOrder.findMany({
    where: isAdmin
      ? {}
      : { OR: [{ buyerId: user.id }, { developerId: user.id }] },
    include: { request: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });

  // ---- Stats -------------------------------------------------------------
  const revenueCents = sales
    .filter((o) => o.status === "PAID")
    .reduce((s, o) => s + o.sellerAmountCents, 0);
  const spentCents = purchases
    .filter((o) => o.status === "PAID")
    .reduce((s, o) => s + o.totalCents, 0);
  const feesCollectedCents = isAdmin
    ? sales
        .filter((o) => o.status === "PAID")
        .reduce((s, o) => s + o.platformFeeCents, 0)
    : 0;

  // ---- Grid rows ----------------------------------------------------------
  const saleRows: OrderRow[] = sales.map((o) => ({
    id: o.id,
    listingTitle: o.listing.title,
    counterparty: o.buyer.name,
    totalCents: o.totalCents,
    sellerShareCents: o.sellerAmountCents,
    platformFeeCents: o.platformFeeCents,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
  }));
  const purchaseRows: OrderRow[] = purchases.map((o) => ({
    id: o.id,
    listingTitle: o.listing.title,
    counterparty: o.seller.name,
    totalCents: o.totalCents,
    sellerShareCents: o.sellerAmountCents,
    platformFeeCents: o.platformFeeCents,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
  }));

  const calendarEvents = bookings.map((b) => ({
    id: b.id,
    name: `Demo: ${b.listing.title} (${b.buyer.name})`,
    startDate: b.startTime.toISOString(),
    endDate: b.endTime.toISOString(),
    notes: b.notes,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {isAdmin ? "Platform admin dashboard" : "Seller dashboard"}
        </h1>
        <Link
          href="/listings/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New listing
        </Link>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={isAdmin ? "Platform fees collected" : "Revenue"}
          value={formatUsd(isAdmin ? feesCollectedCents : revenueCents)}
        />
        <StatCard
          label="Sales"
          value={String(sales.filter((o) => o.status === "PAID").length)}
        />
        <StatCard label="Active listings" value={String(myListings.filter((l) => l.status === "ACTIVE").length)} />
        <StatCard label="Spent (purchases)" value={formatUsd(spentCents)} />
      </div>

      {/* Transactions grid */}
      <section className="mt-8">
        <h2 className="mb-3 font-semibold">
          {isAdmin ? "All marketplace transactions" : "Your sales"}
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <SalesGrid rows={saleRows} />
        </div>
      </section>

      {purchases.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Your purchases</h2>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <SalesGrid rows={purchaseRows} />
          </div>
        </section>
      )}

      {/* My listings */}
      <section className="mt-8">
        <h2 className="mb-3 font-semibold">Your listings</h2>
        {myListings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No listings yet —{" "}
            <Link href="/listings/new" className="text-indigo-600 underline">
              sell your first app
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">AI verification</th>
                  <th className="px-4 py-2">Views</th>
                </tr>
              </thead>
              <tbody>
                {myListings.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <Link
                        href={`/listings/${l.id}`}
                        className="text-indigo-700 hover:underline"
                      >
                        {l.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{formatUsd(l.priceCents)}</td>
                    <td className="px-4 py-2">{l.status}</td>
                    <td className="px-4 py-2">{l.verificationStatus}</td>
                    <td className="px-4 py-2">{l.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Custom orders */}
      {myCustomOrders.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Custom order escrows</h2>
          <div className="space-y-2">
            {myCustomOrders.map((o) => (
              <Link
                key={o.id}
                href={`/custom-orders/${o.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm hover:border-indigo-300"
              >
                <span>{o.request.title}</span>
                <span className="text-slate-500">
                  {formatUsd(o.amountCents)} · {o.status}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Demo bookings — Bryntum calendar */}
      <section className="mt-8">
        <h2 className="mb-3 font-semibold">Demo bookings</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <BookingsCalendar events={calendarEvents} />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
