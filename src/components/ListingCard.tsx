/**
 * Card shown in the browse grid for one listed SaaS business.
 * Server component — pure rendering, links to the detail page.
 */
import Link from "next/link";
import { formatUsd } from "@/lib/money";

export interface ListingCardData {
  id: string;
  title: string;
  tagline: string | null;
  category: string;
  priceCents: number;
  verificationStatus: string;
  aiQualityScore: number | null;
  sellerName: string;
}

export function ListingCard({ listing }: { listing: ListingCardData }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {listing.category}
          </span>
          <h3 className="mt-2 font-semibold text-slate-900 group-hover:text-indigo-700">
            {listing.title}
          </h3>
        </div>
        {listing.verificationStatus === "PASSED" && (
          <span
            className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
            title={`AI verification passed — quality score ${listing.aiQualityScore ?? "-"}/100`}
          >
            AI Verified {listing.aiQualityScore ?? ""}
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-600">
        {listing.tagline ?? ""}
      </p>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-500">by {listing.sellerName}</span>
        <span className="font-semibold text-slate-900">
          {formatUsd(listing.priceCents)}
        </span>
      </div>
    </Link>
  );
}
