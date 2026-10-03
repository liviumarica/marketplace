/**
 * Custom builds board — buyers post requests, developers pick them up and
 * build the app with AI assistance at minimal cost.
 *
 * Each request is a glass "mission card" with status chip, budget and
 * offer count; cards reveal with a stagger as the user scrolls.
 */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatUsd } from "@/lib/money";
import { PageTransition } from "@/components/fx/PageTransition";
import { PageHeader } from "@/components/fx/PageHeader";
import { Reveal } from "@/components/fx/Reveal";
import { SpotlightCard } from "@/components/fx/SpotlightCard";
import { Magnetic } from "@/components/fx/Magnetic";

// Neon chip variant per request status.
const STATUS_CHIPS: Record<string, string> = {
  OPEN: "chip-green",
  IN_PROGRESS: "chip-cyan",
  DELIVERED: "chip-amber",
  COMPLETED: "",
  CANCELLED: "chip-rose",
};

export default async function RequestsPage() {
  const user = await getSessionUser();
  const requests = await prisma.customRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      buyer: { select: { name: true } },
      _count: { select: { offers: true } },
    },
  });

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <PageHeader
          eyebrow="Custom builds"
          title="Describe it. Get it built."
          subtitle="Developers build your app with AI at minimal cost. Your payment sits in PayPal escrow until you accept delivery."
          action={
            <Magnetic>
              <Link href="/requests/new" className="btn-primary">
                Post a request →
              </Link>
            </Magnetic>
          }
        />

        <div className="mt-12 space-y-4">
          {requests.length === 0 && (
            <div className="glass rounded-3xl p-14 text-center">
              <p className="text-muted">No requests yet.</p>
              <Link href="/requests/new" className="btn-primary mt-5">
                Post the first one
              </Link>
            </div>
          )}
          {requests.map((r, i) => (
            <Reveal key={r.id} delay={Math.min(i, 6) * 0.06}>
              <Link href={`/requests/${r.id}`} className="block">
                <SpotlightCard tilt={2} glow="34,211,238">
                  <div className="flex flex-wrap items-center justify-between gap-6 p-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-white transition-colors group-hover:text-cyan-200">
                          {r.title}
                        </h2>
                        <span className={`chip ${STATUS_CHIPS[r.status] ?? ""}`}>
                          {r.status.replace("_", " ")}
                        </span>
                        {r.buyerId === user?.id && <span className="chip chip-violet">yours</span>}
                      </div>
                      <p className="text-muted mt-2 line-clamp-2 max-w-2xl text-sm">{r.brief}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-2xl font-bold text-white">
                        {formatUsd(r.budgetCents)}
                      </div>
                      <div className="text-dim mt-1 text-xs">
                        {r.deadlineDays} days · {r._count.offers} offer
                        {r._count.offers === 1 ? "" : "s"}
                      </div>
                      <div className="text-dim text-xs">by {r.buyer.name}</div>
                    </div>
                  </div>
                </SpotlightCard>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
