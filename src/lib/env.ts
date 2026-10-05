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
  /** SQLite locally, hosted PostgreSQL on Vercel. */
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "file:./dev.db";
  },

  /** Secret used to sign the JWT session cookie. */
  get authSecret() {
    if (process.env.NODE_ENV === "production") return required("AUTH_SECRET");
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

  /**
   * Resend (https://resend.com) API key — used for every transactional email
   * (verification, password reset, welcome). Required to send email; without
   * it the email helpers throw a descriptive error instead of faking success.
   */
  get resendApiKey() {
    return required("RESEND_API_KEY");
  },
  /**
   * Sender identity for all transactional email. Defaults to the
   * marketplace's own address on adskings.com (domain verified in Resend);
   * override with EMAIL_FROM, e.g. `AgentBay <no-reply@otherdomain.com>`.
   */
  get emailFrom() {
    return process.env.EMAIL_FROM || "AgentBay <market@adskings.com>";
  },

  /**
   * Public base URL of this deployment (used for webhook, PayPal return URLs
   * and the links inside emails). Resolution order:
   *   1. APP_URL (explicit, recommended),
   *   2. VERCEL_PROJECT_PRODUCTION_URL — the stable production domain, so
   *      emailed links never point at a short-lived preview deployment,
   *   3. VERCEL_URL — the current deployment,
   *   4. localhost for `npm run dev`.
   */
  get appUrl() {
    const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
    return (
      process.env.APP_URL ||
      (vercelHost ? `https://${vercelHost}` : "http://localhost:3000")
    ).replace(/\/$/, "");
  },
};
