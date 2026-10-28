/**
 * GET /api/channel3/benchmark?q=...
 * Real call to the Channel3 product API (v1 search) — pulls comparable
 * products across retailers so buyers can sanity-check the asking price
 * against the broader market. Returns normalized benchmark stats.
 *
 * Channel3 moved search from /v0 to /v1 in 2026: the response is now
 * `{ products, next_page_token }` and prices live under
 * `products[i].offers[j].price.price`.
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

interface Channel3Offer {
  price?: { price?: number; compare_at_price?: number | null; currency?: string };
  domain?: string;
}

interface Channel3Product {
  title?: string;
  offers?: Channel3Offer[];
  brands?: { name?: string }[];
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "";
  if (!env.channel3ApiKey) {
    // Sponsor key not configured — surface that honestly rather than faking data.
    return NextResponse.json(
      { configured: false, benchmark: null },
      { status: 200 },
    );
  }
  if (!query.trim()) {
    return NextResponse.json(
      { configured: true, benchmark: null, error: "Missing query" },
      { status: 400 },
    );
  }

  // Channel3 v1 search endpoint — returns normalized product data.
  const res = await fetch("https://api.trychannel3.com/v1/search", {
    method: "POST",
    headers: {
      "x-api-key": env.channel3ApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit: 20 }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { configured: true, benchmark: null, error: `Channel3 ${res.status}` },
      { status: 502 },
    );
  }

  const json = (await res.json()) as { products?: Channel3Product[] };
  const products = json.products ?? [];

  const priceOf = (p: Channel3Product): number | null => {
    const v = p.offers?.[0]?.price?.price;
    return typeof v === "number" && v > 0 ? v : null;
  };

  // Extract usable prices and compute benchmark stats.
  const prices = products
    .map(priceOf)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  const median =
    prices.length > 0 ? prices[Math.floor(prices.length / 2)] : null;
  const benchmark = {
    query,
    sampleSize: prices.length,
    minPrice: prices[0] ?? null,
    maxPrice: prices[prices.length - 1] ?? null,
    medianPrice: median,
    // keep a few real product examples for transparency
    examples: products.slice(0, 4).map((p) => ({
      title: p.title ?? "Unnamed product",
      price: priceOf(p),
      brand: p.brands?.[0]?.name ?? null,
    })),
  };

  return NextResponse.json({ configured: true, benchmark });
}
