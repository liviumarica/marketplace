/**
 * Elasticsearch integration — real semantic (vector) search over listings.
 *
 * Each listing is indexed with a text-embedding (1536-dim, OpenAI
 * text-embedding-3-small). Queries are embedded the same way and matched with
 * a kNN vector search combined with keyword BM25 — genuine hybrid retrieval,
 * not keyword matching dressed up as "AI search".
 *
 * Every function degrades gracefully: if ES isn't reachable it returns
 * null/empty and callers fall back to SQL search — the marketplace still
 * works, search just loses the semantic layer until ES is configured.
 */
import { Client } from "@elastic/elasticsearch";
import { embed } from "ai";
import { env } from "@/lib/env";
import { embeddingModel } from "@/lib/ai";
import type { Listing } from "@/generated/prisma/client";

const INDEX = "listings";

let _client: Client | undefined;

function client(): Client {
  if (!_client) {
    _client = new Client({
      node: env.elasticUrl,
      ...(env.elasticApiKey ? { auth: { apiKey: env.elasticApiKey } } : {}),
    });
  }
  return _client;
}

/** Build the text a listing is embedded from — title + content signals. */
function docText(listing: Listing): string {
  const tech: string[] = JSON.parse(listing.techStack || "[]");
  return [
    listing.title,
    listing.tagline ?? "",
    listing.category,
    tech.join(" "),
    listing.description.slice(0, 2000),
  ].join("\n");
}

/** Create the index mapping once — dense_vector + text fields. */
async function ensureIndex(): Promise<void> {
  const es = client();
  const exists = await es.indices.exists({ index: INDEX });
  if (exists) return;
  await es.indices.create({
    index: INDEX,
    mappings: {
      properties: {
        title: { type: "text" },
        tagline: { type: "text" },
        description: { type: "text" },
        category: { type: "keyword" },
        embedding: {
          type: "dense_vector",
          dims: 1536,
          index: true,
          similarity: "cosine",
        },
      },
    },
  });
}

/** Index (or re-index) a single listing. No-ops if ES is unreachable. */
export async function indexListing(listing: Listing): Promise<void> {
  try {
    await ensureIndex();
    const { embedding } = await embed({
      model: embeddingModel(),
      value: docText(listing),
    });
    await client().index({
      index: INDEX,
      id: listing.id,
      document: {
        title: listing.title,
        tagline: listing.tagline,
        description: listing.description,
        category: listing.category,
        embedding,
      },
    });
  } catch (err) {
    console.warn(`Elastic index failed for listing ${listing.id}:`, err);
  }
}

/** Remove a listing from the search index (sold / removed). */
export async function removeListingFromIndex(listingId: string): Promise<void> {
  try {
    await client().delete({ index: INDEX, id: listingId });
  } catch {
    // Missing index/doc is fine — nothing to remove.
  }
}

export interface SemanticHit {
  id: string;
  score: number;
}

/**
 * Hybrid search: kNN on the query embedding + BM25 keyword match, combined.
 * Returns listing ids ranked by relevance, or null when ES isn't available.
 */
export async function searchListingsSemantic(
  query: string,
  size = 12,
): Promise<SemanticHit[] | null> {
  try {
    await ensureIndex();
    const { embedding } = await embed({
      model: embeddingModel(),
      value: query,
    });
    const res = await client().search({
      index: INDEX,
      size,
      query: {
        multi_match: {
          query,
          fields: ["title^3", "tagline^2", "description", "category"],
        },
      },
      knn: {
        field: "embedding",
        query_vector: embedding,
        k: size,
        num_candidates: size * 4,
      },
    });
    return res.hits.hits.map((h) => ({
      id: h._id as string,
      score: h._score ?? 0,
    }));
  } catch (err) {
    console.warn("Elastic search unavailable, falling back to SQL:", err);
    return null;
  }
}
