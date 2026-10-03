/**
 * Centralised, validated access to environment variables.
 *
 * Anything that is required for a given feature is validated lazily by the
 * getter that needs it, so `npm run dev` still boots with only the database
 * configured — but attempting a real PayPal / AI / sponsor call without the
 * matching credentials throws a descriptive error instead of failing deep
 * inside a third-party SDK.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example to .env and fill in real credentials.`,
    );
  }
  return value;
}

export const env = {
  /** SQLite connection string used by Prisma (file:./dev.db locally). */
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "file:./dev.db";
  },

  /** Secret used to sign the JWT session cookie. */
  get authSecret() {
    return process.env.AUTH_SECRET ?? "dev-only-insecure-secret-change-me";
  },

  /** PayPal REST app credentials — create them at developer.paypal.com (sandbox). */
  get paypalClientId() {
    return required("PAYPAL_CLIENT_ID");
  },
  get paypalClientSecret() {
    return required("PAYPAL_CLIENT_SECRET");
  },
  /**
   * Merchant ID of the platform's sandbox business account — the account that
   * receives the marketplace commission on every transaction.
   */
  get platformMerchantId() {
    return required("PAYPAL_PLATFORM_MERCHANT_ID");
  },
  /** "sandbox" | "live" — controls both the REST host and the JS SDK URL. */
  get paypalEnv() {
    return (process.env.PAYPAL_ENV ?? "sandbox") as "sandbox" | "live";
  },

  /**
   * How the marketplace commission is taken on listing sales:
   *  - "multi_unit": one order, two purchase units with different payees
   *    (seller + platform). Production-grade shape, needs seller consent /
   *    partner onboarding on live.
   *  - "payout": full amount captured to the platform, then the seller share
   *    is paid out via the Payouts API. Works in every sandbox out of the box.
   */
  get paypalSplitMode() {
    return (process.env.PAYPAL_SPLIT_MODE ?? "payout") as
      | "multi_unit"
      | "payout";
  },

  /** Marketplace commission in basis points — 1000 = 10%. */
  get platformFeeBps() {
    return Number(process.env.PLATFORM_FEE_BPS ?? "1000");
  },

  /** LLM configuration (OpenAI-compatible — works with OpenRouter/Groq/etc.). */
  get openaiApiKey() {
    return required("OPENAI_API_KEY");
  },
  get openaiBaseUrl() {
    return process.env.OPENAI_BASE_URL; // optional: point at any compatible API
  },
  get openaiModel() {
    return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  },

  /** Elasticsearch connection (local docker or Elastic Cloud). */
  get elasticUrl() {
    return process.env.ELASTIC_URL ?? "http://localhost:9200";
  },
  get elasticApiKey() {
    return process.env.ELASTIC_API_KEY; // optional for local docker
  },

  /** KERNEL — cloud browser infrastructure for the AI verification agent. */
  get kernelApiKey() {
    return process.env.KERNEL_API_KEY; // optional until verification is used
  },

  /** Channel3 — real product data used for price benchmarking. */
  get channel3ApiKey() {
    return process.env.CHANNEL3_API_KEY;
  },

  /** Public base URL of this deployment (used for webhook + PayPal return URLs). */
  get appUrl() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
};
