/**
 * Custom builds board — buyers post requests, developers pick them up and
 * build the app with AI assistance at minimal cost.
 */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatUsd } from "@/lib/money";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-emerald-50 text-emerald-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  DELIVERED: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-red-50 text-red-600",
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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Custom builds</h1>
          <p className="mt-1 text-sm text-slate-600">
            Describe the app you need — developers build it with AI at minimal
            cost. Your payment sits in PayPal escrow until you accept delivery.
          </p>
        </div>
        <Link
          href="/requests/new"
          className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
        >
          Post a request
        </Link>
      </div>

      <div className="mt-8 space-y-3">
        {requests.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
            No requests yet —{" "}
            <Link href="/requests/new" className="text-indigo-600 underline">
              post the first one
            </Link>
            .
          </div>
        )}
        {requests.map((r) => (
          <Link
            key={r.id}
            href={`/requests/${r.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{r.title}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-slate-100"}`}
                  >
                    {r.status.replace("_", " ")}
                  </span>
                  {r.buyerId === user?.id && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                      yours
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-slate-600">
                  {r.brief}
                </p>
              </div>
              <div className="text-right text-sm">
                <div className="font-semibold">{formatUsd(r.budgetCents)}</div>
                <div className="text-slate-500">
                  {r.deadlineDays} days · {r._count.offers} offer
                  {r._count.offers === 1 ? "" : "s"}
                </div>
                <div className="text-xs text-slate-400">
                  by {r.buyer.name}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
