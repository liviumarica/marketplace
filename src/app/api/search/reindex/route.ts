/**
 * POST /api/search/reindex — admin-only. Re-indexes every ACTIVE listing into
 * Elasticsearch (embeddings included). Used once after ES is first configured.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { indexListing } from "@/lib/elastic";

export async function POST() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
  });
  let indexed = 0;
  for (const l of listings) {
    await indexListing(l);
    indexed++;
  }
  return NextResponse.json({ indexed });
}
