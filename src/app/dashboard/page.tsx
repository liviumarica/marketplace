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
import { PageTransition } from "@/components/fx/PageTransition";
import { PageHeader } from "@/components/fx/PageHeader";
import { Reveal } from "@/components/fx/Reveal";
import { SpotlightCard } from "@/components/fx/SpotlightCard";
import { AnimatedCounter } from "@/components/fx/AnimatedCounter";

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
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <PageHeader
          eyebrow={isAdmin ? "Admin control room" : "Control room"}
          title={isAdmin ? "Platform admin dashboard" : "Seller dashboard"}
          subtitle={`Welcome back, ${user.name}. Everything below is live data.`}
          action={
            <Link href="/listings/new" className="btn-primary">
              + New listing
            </Link>
          }
        />

        {/* Stat cards — values count up from real aggregates */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={isAdmin ? "Platform fees collected" : "Revenue"}
            value={isAdmin ? feesCollectedCents : revenueCents}
            format="usd"
            glow="139,92,246"
            delay={0}
          />
          <StatCard
            label="Sales"
            value={sales.filter((o) => o.status === "PAID").length}
            glow="34,211,238"
            delay={0.08}
          />
          <StatCard
            label="Active listings"
            value={myListings.filter((l) => l.status === "ACTIVE").length}
            glow="232,121,249"
            delay={0.16}
          />
          <StatCard
            label="Spent (purchases)"
            value={spentCents}
            format="usd"
            glow="163,230,53"
            delay={0.24}
          />
        </div>

        {/* Transactions grid */}
        <Reveal>
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-semibold text-white">
              {isAdmin ? "All marketplace transactions" : "Your sales"}
            </h2>
            <div className="glass rounded-2xl p-3">
              <SalesGrid rows={saleRows} />
            </div>
          </section>
        </Reveal>

        {purchases.length > 0 && (
          <Reveal>
            <section className="mt-12">
              <h2 className="mb-4 text-xl font-semibold text-white">Your purchases</h2>
              <div className="glass rounded-2xl p-3">
                <SalesGrid rows={purchaseRows} />
              </div>
            </section>
          </Reveal>
        )}

        {/* My listings */}
        <Reveal>
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-semibold text-white">Your listings</h2>
            {myListings.length === 0 ? (
              <p className="glass text-muted rounded-2xl p-10 text-center text-sm">
                No listings yet —{" "}
                <Link href="/listings/new" className="link-neon">
                  sell your first app
                </Link>
                .
              </p>
            ) : (
              <div className="glass overflow-hidden rounded-2xl">
                <table className="table-neon w-full text-sm">
                  <thead className="text-left">
                    <tr>
                      <th className="px-5 py-3">Title</th>
                      <th className="px-5 py-3">Price</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">AI verification</th>
                      <th className="px-5 py-3">Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myListings.map((l) => (
                      <tr key={l.id}>
                        <td className="px-5 py-3">
                          <Link href={`/listings/${l.id}`} className="font-medium text-white hover:text-cyan-200">
                            {l.title}
                          </Link>
                        </td>
                        <td className="px-5 py-3 font-mono text-white/80">{formatUsd(l.priceCents)}</td>
                        <td className="px-5 py-3">
                          <span className={`chip ${l.status === "ACTIVE" ? "chip-green" : ""}`}>{l.status}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`chip ${
                              l.verificationStatus === "PASSED"
                                ? "chip-green"
                                : l.verificationStatus === "RUNNING"
                                  ? "chip-amber"
                                  : l.verificationStatus === "FAILED"
                                    ? "chip-rose"
                                    : ""
                            }`}
                          >
                            {l.verificationStatus}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-white/70">{l.views}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </Reveal>

        {/* Custom orders */}
        {myCustomOrders.length > 0 && (
          <Reveal>
            <section className="mt-12">
              <h2 className="mb-4 text-xl font-semibold text-white">Custom order escrows</h2>
              <div className="space-y-2">
                {myCustomOrders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/custom-orders/${o.id}`}
                    className="glass group flex items-center justify-between rounded-xl px-5 py-4 text-sm transition hover:border-cyan-300/40"
                  >
                    <span className="font-medium text-white group-hover:text-cyan-200">{o.request.title}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-white/80">{formatUsd(o.amountCents)}</span>
                      <span className="chip">{o.status}</span>
                      <span aria-hidden className="text-white/40 transition group-hover:translate-x-1 group-hover:text-cyan-300">
                        →
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        {/* Demo bookings — Bryntum calendar */}
        <Reveal>
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-semibold text-white">Demo bookings</h2>
            <div className="glass rounded-2xl p-3">
              <BookingsCalendar events={calendarEvents} />
            </div>
          </section>
        </Reveal>
      </div>
    </PageTransition>
  );
}

/** Glass KPI tile with a glowing accent and an animated count-up value. */
function StatCard({
  label,
  value,
  format = "int",
  glow,
  delay,
}: {
  label: string;
  value: number;
  format?: "int" | "usd";
  glow: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <SpotlightCard glow={glow} tilt={5}>
        <div className="relative overflow-hidden p-6">
          <div
            aria-hidden
            className="absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl"
            style={{ background: `rgba(${glow},0.35)` }}
          />
          <div className="text-dim relative text-xs uppercase tracking-[0.16em]">{label}</div>
          <AnimatedCounter
            value={value}
            format={format}
            className="relative mt-3 block font-[family-name:var(--font-display)] text-3xl font-bold text-white"
          />
        </div>
      </SpotlightCard>
    </Reveal>
  );
}
