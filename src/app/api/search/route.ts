/**
 * GET /api/search?q=...
 * Semantic search endpoint — uses Elasticsearch vector search when it's
 * reachable, SQL LIKE otherwise. Always returns real listing rows.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchListingsSemantic } from "@/lib/elastic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ listings: [], engine: "none" });
  }

  // Try semantic search first.
  const hits = await searchListingsSemantic(q);
  if (hits && hits.length > 0) {
    const rows = await prisma.listing.findMany({
      where: { id: { in: hits.map((h) => h.id) }, status: "ACTIVE" },
      include: { seller: { select: { name: true } } },
    });
    // Preserve the relevance order ES returned.
    const order = new Map(hits.map((h, i) => [h.id, i]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return NextResponse.json({ listings: rows, engine: "elastic" });
  }

  // SQL fallback — same shape, honest keyword matching.
  const rows = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { category: { contains: q } },
        { techStack: { contains: q } },
      ],
    },
    include: { seller: { select: { name: true } } },
    take: 24,
  });
  return NextResponse.json({ listings: rows, engine: "sql" });
}
