/**
 * GET /api/channel3/benchmark?q=...&category=...
 * Real call to the Channel3 product API — pulls comparable software products
 * across thousands of retailers so buyers can sanity-check the asking price
 * against the broader market. Returns normalized benchmark stats.
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

interface Channel3Product {
  title?: string;
  price?: number;
  offers?: { price?: number }[];
  brand?: { name?: string };
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

  // Channel3 search endpoint — returns normalized product data.
  const res = await fetch("https://api.trychannel3.com/v0.1/products/search", {
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

  const json = (await res.json()) as {
    products?: Channel3Product[];
    data?: Channel3Product[];
  };
  const products = json.products ?? json.data ?? [];

  // Extract usable prices and compute benchmark stats.
  const prices = products
    .map((p) => p.price ?? p.offers?.[0]?.price)
    .filter((v): v is number => typeof v === "number" && v > 0)
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
      price: p.price ?? p.offers?.[0]?.price ?? null,
      brand: p.brand?.name ?? null,
    })),
  };

  return NextResponse.json({ configured: true, benchmark });
}
