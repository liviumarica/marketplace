/**
 * Home / browse page — lists all ACTIVE SaaS businesses for sale.
 * A query param `?q=` filters through the semantic search endpoint when
 * Elastic is configured, falling back to a SQL LIKE search otherwise.
 */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { searchListingsSemantic } from "@/lib/elastic";
import { ListingCard } from "@/components/ListingCard";

const sellerInclude = { seller: { select: { name: true } } } as const;

interface HomeProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  // Search order: real Elastic hybrid (kNN + BM25) when reachable, plain SQL
  // LIKE otherwise. Both paths return real listing rows — never fixtures.
  let listings;
  if (query) {
    const hits = await searchListingsSemantic(query);
    if (hits && hits.length > 0) {
      const rows = await prisma.listing.findMany({
        where: { id: { in: hits.map((h) => h.id) }, status: "ACTIVE" },
        include: sellerInclude,
      });
      // Preserve the relevance order Elasticsearch returned.
      const rank = new Map(hits.map((h, i) => [h.id, i]));
      rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
      listings = rows;
    } else {
      listings = await prisma.listing.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
            { category: { contains: query } },
            { techStack: { contains: query } },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: sellerInclude,
      });
    }
  } else {
    listings = await prisma.listing.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: sellerInclude,
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 px-8 py-12 text-white">
        <h1 className="max-w-2xl text-3xl font-bold md:text-4xl">
          Buy a complete AI-built SaaS business. Or have one built for you.
        </h1>
        <p className="mt-3 max-w-2xl text-indigo-100">
          Every listing is verified by an AI agent that actually runs the app.
          Payments split automatically between seller and platform via PayPal.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/listings/new"
            className="rounded-md bg-white px-4 py-2 font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Sell your AI-built app
          </Link>
          <Link
            href="/requests/new"
            className="rounded-md border border-indigo-300 px-4 py-2 font-medium text-white hover:bg-white/10"
          >
            Order a custom app
          </Link>
          <Link
            href="/chat"
            className="rounded-md border border-indigo-300 px-4 py-2 font-medium text-white hover:bg-white/10"
          >
            Ask the AI agent
          </Link>
        </div>
      </section>

      {/* Search */}
      <form className="mt-8 flex gap-2" action="/" method="get">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search apps — e.g. 'invoicing tool for freelancers'"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Search
        </button>
      </form>

      {/* Grid */}
      <section className="mt-8">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">
            {query ? `Results for “${query}”` : "SaaS businesses for sale"}
          </h2>
          <span className="text-sm text-slate-500">
            {listings.length} listing{listings.length === 1 ? "" : "s"}
          </span>
        </div>
        {listings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
            No listings yet.{" "}
            <Link href="/listings/new" className="text-indigo-600 underline">
              List the first AI-built app
            </Link>
            .
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={{
                  id: l.id,
                  title: l.title,
                  tagline: l.tagline,
                  category: l.category,
                  priceCents: l.priceCents,
                  verificationStatus: l.verificationStatus,
                  aiQualityScore: l.aiQualityScore,
                  sellerName: l.seller.name,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
