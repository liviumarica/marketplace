/**
 * PayPal Agent Toolkit tools, adapted for AI SDK v7.
 *
 * The official @paypal/agent-toolkit builds tools with the legacy `parameters`
 * field; AI SDK v7 expects `inputSchema`. We re-wrap each toolkit tool so they
 * work with streamText — the execute functions are untouched and still make
 * real PayPal API calls against our sandbox app.
 */
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { tool, type Tool } from "ai";
import type { ZodTypeAny } from "zod";
import { env } from "@/lib/env";

interface LegacyTool {
  description?: string;
  parameters: ZodTypeAny;
  execute: (args: unknown) => Promise<unknown>;
}

let _tools: Record<string, Tool> | undefined;

/**
 * Real PayPal API tools available to the shopping agent:
 * create_order / get_order (payments), create_invoice / list_invoices /
 * send_invoice (invoicing), list_transactions, list_disputes.
 */
export function paypalAgentTools(): Record<string, Tool> {
  if (_tools) return _tools;

  const toolkit = new PayPalAgentToolkit({
    clientId: env.paypalClientId,
    clientSecret: env.paypalClientSecret,
    configuration: {
      actions: {
        orders: { create: true, get: true },
        invoices: {
          create: true,
          list: true,
          send: true,
          get: true,
        },
        transactions: { list: true },
        disputes: { list: true, get: true },
        products: { create: true, list: true },
      },
      context: { sandbox: env.paypalEnv === "sandbox" },
    },
  });

  const wrapped: Record<string, Tool> = {};
  for (const [name, t] of Object.entries(
    toolkit.getTools() as unknown as Record<string, LegacyTool>,
  )) {
    wrapped[name] = tool({
      description: t.description ?? `PayPal ${name}`,
      inputSchema: t.parameters,
      execute: async (args) => t.execute(args),
    }) as unknown as Tool;
  }
  _tools = wrapped;
  return wrapped;
}
