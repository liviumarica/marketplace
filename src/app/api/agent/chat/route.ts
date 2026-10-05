/**
 * POST /api/agent/chat — the AI shopping agent.
 *
 * A conversational buyer agent with REAL tools:
 *  - search_listings / get_listing_details → our catalogue (Elastic + SQL)
 *  - create_purchase_order → creates a real order + PayPal checkout with the
 *    commission split, and returns the PayPal approval link for the buyer
 *  - create_paypal_invoice → real PayPal invoice via the official
 *    @paypal/agent-toolkit (agentic commerce: the agent issues invoices)
 *  - get_paypal_order → real order status via the toolkit
 *
 * Streams the response to the client (Vercel AI SDK UI message stream).
 */
import { NextRequest } from "next/server";
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  tool,
  type Tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { chatModel } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { searchListingsSemantic } from "@/lib/elastic";
import { createSaleOrder } from "@/lib/paypal";
import { paypalAgentTools } from "@/lib/paypal-agent-tools";
import { env } from "@/lib/env";
import { platformFee } from "@/lib/money";
import { isPayoutReady, SELLER_NOT_PAYOUT_READY } from "@/lib/payout";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  // ---- Marketplace tools -------------------------------------------------
  const marketplaceTools = {
    search_listings: tool({
      description:
        "Search the marketplace for SaaS businesses for sale. Use natural " +
        "language — semantic search ranks by meaning, not just keywords.",
      inputSchema: z.object({
        query: z.string().describe("What the buyer is looking for"),
        maxPriceUsd: z.number().optional().describe("Budget ceiling in USD"),
      }),
      execute: async ({ query, maxPriceUsd }) => {
        const hits = await searchListingsSemantic(query);
        let rows;
        if (hits && hits.length > 0) {
          rows = await prisma.listing.findMany({
            where: { id: { in: hits.map((h) => h.id) }, status: "ACTIVE" },
          });
          const order = new Map(hits.map((h, i) => [h.id, i]));
          rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        } else {
          rows = await prisma.listing.findMany({
            where: {
              status: "ACTIVE",
              OR: [
                { title: { contains: query } },
                { description: { contains: query } },
                { category: { contains: query } },
                { techStack: { contains: query } },
              ],
            },
            take: 10,
          });
        }
        if (maxPriceUsd != null) {
          rows = rows.filter((r) => r.priceCents <= maxPriceUsd * 100);
        }
        return rows.slice(0, 8).map((l) => ({
          listingId: l.id,
          title: l.title,
          tagline: l.tagline,
          category: l.category,
          priceUsd: l.priceCents / 100,
          aiVerified: l.verificationStatus === "PASSED",
          aiQualityScore: l.aiQualityScore,
        }));
      },
    }),

    get_listing_details: tool({
      description: "Get full details about one listing, including features, tech stack and verification status.",
      inputSchema: z.object({ listingId: z.string() }),
      execute: async ({ listingId }) => {
        const l = await prisma.listing.findUnique({
          where: { id: listingId },
          include: { seller: { select: { name: true } } },
        });
        if (!l) return { error: "Listing not found" };
        return {
          listingId: l.id,
          title: l.title,
          tagline: l.tagline,
          description: l.description,
          category: l.category,
          techStack: JSON.parse(l.techStack || "[]"),
          features: JSON.parse(l.features || "[]"),
          priceUsd: l.priceCents / 100,
          demoUrl: l.demoUrl,
          status: l.status,
          aiVerified: l.verificationStatus === "PASSED",
          aiQualityScore: l.aiQualityScore,
          seller: l.seller.name,
        };
      },
    }),

    create_purchase_order: tool({
      description:
        "Create a real purchase for a listing: an internal order plus a PayPal " +
        "checkout whose funds split automatically between the seller and the " +
        "platform. Returns the PayPal approval link the buyer must open to pay.",
      inputSchema: z.object({ listingId: z.string() }),
      execute: async ({ listingId }) => {
        if (!user) {
          return {
            error:
              "The buyer must be logged in to purchase — ask them to log in first.",
          };
        }
        const listing = await prisma.listing.findUnique({
          where: { id: listingId },
          include: { seller: true },
        });
        if (!listing || listing.status !== "ACTIVE") {
          return { error: "Listing is not available for purchase" };
        }
        if (listing.sellerId === user.id) {
          return { error: "You cannot buy your own listing" };
        }
        // Same rules as POST /api/orders/create.
        if (!user.emailVerifiedAt) {
          return {
            error:
              "The buyer must verify their email address before purchasing — ask them to click the link in the verification email (or resend it from the banner).",
          };
        }
        if (!isPayoutReady(listing.seller)) {
          return { error: SELLER_NOT_PAYOUT_READY };
        }

        const feeCents = platformFee(listing.priceCents, env.platformFeeBps);
        const order = await prisma.order.create({
          data: {
            buyerId: user.id,
            sellerId: listing.sellerId,
            listingId: listing.id,
            totalCents: listing.priceCents,
            platformFeeCents: feeCents,
            sellerAmountCents: listing.priceCents - feeCents,
          },
        });
        try {
          const paypalOrder = await createSaleOrder({
            sellerMerchantId: listing.seller.paypalMerchantId,
            sellerEmail: listing.seller.paypalEmail,
            totalCents: listing.priceCents,
            referenceId: order.id,
            description: `AgentBay: ${listing.title} (business acquisition)`,
          });
          await prisma.order.update({
            where: { id: order.id },
            data: { paypalOrderId: paypalOrder.id },
          });
          const approveLink = paypalOrder.links?.find(
            (l) => l.rel === "approve" || l.rel === "payer-action",
          )?.href;
          return {
            orderId: order.id,
            paypalOrderId: paypalOrder.id,
            totalUsd: listing.priceCents / 100,
            sellerShareUsd: (listing.priceCents - feeCents) / 100,
            platformFeeUsd: feeCents / 100,
            approvalUrl: approveLink,
            instruction:
              "Send the buyer this approval link — after they approve in " +
              "PayPal they're redirected back and the payment is captured.",
          };
        } catch (err) {
          await prisma.order.delete({ where: { id: order.id } });
          throw err;
        }
      },
    }),
  };

  // ---- PayPal Agent Toolkit tools (official) ------------------------------
  // Wrapped for AI SDK v7; each makes real calls against our sandbox app.
  let ppTools: Record<string, Tool> = {};
  try {
    const all = paypalAgentTools();
    ppTools = {
      create_paypal_invoice: all.create_invoice,
      send_paypal_invoice: all.send_invoice,
      get_paypal_order: all.get_order,
      list_paypal_transactions: all.list_transactions,
    };
  } catch (err) {
    console.warn("PayPal Agent Toolkit unavailable:", err);
  }

  const result = streamText({
    model: chatModel(),
    system:
      `You are the AgentBay shopping agent — you help buyers discover and ` +
      `purchase complete AI-built SaaS businesses on this marketplace.\n\n` +
      `You have REAL tools: searching the catalogue creates actual queries, ` +
      `and create_purchase_order / create_paypal_invoice perform real PayPal ` +
      `operations on our sandbox environment. Never pretend an action ` +
      `happened — always call the tool and report its actual result.\n\n` +
      `When a buyer wants to purchase: call create_purchase_order, then give ` +
      `them the approvalUrl to open. For custom work or seller invoicing, use ` +
      `create_paypal_invoice. Be concise, factual, and helpful.` +
      (user ? `\n\nThe buyer is logged in as ${user.name} (${user.email}).` : ""),
    messages: await convertToModelMessages(messages),
    tools: { ...marketplaceTools, ...ppTools },
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}
