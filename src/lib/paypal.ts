/**
 * PayPal integration — the heart of the marketplace money flow.
 *
 * Real sandbox calls only, two settlement modes supported:
 *
 *  1. "multi_unit" — a single Order containing two purchase units with
 *     different `payee`s: the seller receives their share directly, the
 *     platform receives its commission. This is the production shape for a
 *     marketplace (on live, sellers onboard via the Partner Referrals API
 *     which grants the platform permission to pay them).
 *
 *  2. "payout" — the full amount is captured to the platform account, then
 *     the seller's share is pushed to them through the Payouts API. Works in
 *     every sandbox without partner onboarding, so it is the default for the
 *     demo. The PayPal dashboards still show two real money movements.
 *
 * Custom orders use intent=AUTHORIZE: funds are held at order time and only
 * captured when the buyer accepts the delivery — a real escrow.
 */
import {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  CheckoutPaymentIntent,
  OrderApplicationContextUserAction,
  type Order,
  type OrderRequest,
  type PurchaseUnitRequest,
} from "@paypal/paypal-server-sdk";
import { env } from "@/lib/env";
import { centsToApi, platformFee } from "@/lib/money";

// -----------------------------------------------------------------------------
// SDK client (orders + payments controllers). Payouts has no controller in the
// SDK, so it is done through plain REST with an OAuth access token below.
// -----------------------------------------------------------------------------

function buildClient(): Client {
  return new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: env.paypalClientId,
      oAuthClientSecret: env.paypalClientSecret,
    },
    environment:
      env.paypalEnv === "live" ? Environment.Production : Environment.Sandbox,
  });
}

let _orders: OrdersController | undefined;
let _payments: PaymentsController | undefined;

export function ordersController(): OrdersController {
  return (_orders ??= new OrdersController(buildClient()));
}

export function paymentsController(): PaymentsController {
  return (_payments ??= new PaymentsController(buildClient()));
}

export function paypalApiBase(): string {
  return env.paypalEnv === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

// -----------------------------------------------------------------------------
// Order helpers
// -----------------------------------------------------------------------------

/**
 * Build the purchase units for a listing purchase.
 * The commission split is visible to PayPal itself in "multi_unit" mode.
 */
export function buildSalePurchaseUnits(params: {
  sellerMerchantId?: string | null;
  sellerEmail?: string | null;
  totalCents: number;
  referenceId: string;
  description: string;
}): PurchaseUnitRequest[] {
  const feeCents = platformFee(params.totalCents, env.platformFeeBps);
  const sellerCents = params.totalCents - feeCents;

  if (env.paypalSplitMode === "payout") {
    // Single unit to the platform; the seller share is settled afterwards
    // through the Payouts API (see payoutToSeller below).
    return [
      {
        referenceId: params.referenceId,
        description: params.description,
        amount: { currencyCode: "USD", value: centsToApi(params.totalCents) },
      },
    ];
  }

  // multi_unit: seller leg + platform-fee leg with distinct payees.
  return [
    {
      referenceId: `${params.referenceId}-seller`,
      description: params.description,
      payee: params.sellerMerchantId
        ? { merchantId: params.sellerMerchantId }
        : undefined,
      amount: { currencyCode: "USD", value: centsToApi(sellerCents) },
      // NOTE: on a PayPal Complete Payments (PPCP) marketplace this leg would
      // additionally carry `paymentInstruction.platformFees` — the canonical
      // commission mechanism. It requires partner enablement, so the demo
      // uses the explicit second purchase unit below which is equivalent.
    },
    {
      referenceId: `${params.referenceId}-fee`,
      description: "Marketplace commission",
      payee: { merchantId: env.platformMerchantId },
      amount: { currencyCode: "USD", value: centsToApi(feeCents) },
    },
  ];
}

/** Create a PayPal order for a listing purchase (intent = CAPTURE). */
export async function createSaleOrder(params: {
  sellerMerchantId?: string | null;
  sellerEmail?: string | null;
  totalCents: number;
  referenceId: string;
  description: string;
}): Promise<Order> {
  const request: OrderRequest = {
    intent: CheckoutPaymentIntent.Capture,
    purchaseUnits: buildSalePurchaseUnits(params),
    applicationContext: {
      returnUrl: `${env.appUrl}/checkout/return`,
      cancelUrl: `${env.appUrl}/checkout/cancel`,
      userAction: OrderApplicationContextUserAction.PayNow,
    },
  };
  const resp = await ordersController().createOrder({
    body: request,
    prefer: "return=representation",
  });
  return resp.result as Order;
}

/** Capture an approved listing-purchase order. */
export async function captureOrder(paypalOrderId: string): Promise<Order> {
  const resp = await ordersController().captureOrder({
    id: paypalOrderId,
    prefer: "return=representation",
  });
  return resp.result as Order;
}

// -----------------------------------------------------------------------------
// Escrow for custom orders — authorize now, capture on delivery acceptance
// -----------------------------------------------------------------------------

/** Create an order with intent=AUTHORIZE — funds are held, not captured. */
export async function createAuthorizeOrder(params: {
  totalCents: number;
  referenceId: string;
  description: string;
}): Promise<Order> {
  const resp = await ordersController().createOrder({
    body: {
      intent: CheckoutPaymentIntent.Authorize,
      purchaseUnits: [
        {
          referenceId: params.referenceId,
          description: params.description,
          amount: {
            currencyCode: "USD",
            value: centsToApi(params.totalCents),
          },
        },
      ],
      applicationContext: {
        returnUrl: `${env.appUrl}/checkout/return`,
        cancelUrl: `${env.appUrl}/checkout/cancel`,
        userAction: OrderApplicationContextUserAction.Continue,
      },
    },
    prefer: "return=representation",
  });
  return resp.result as Order;
}

/**
 * Authorize an approved order — returns the authorization ID that holds the
 * buyer's funds until we capture or void it.
 */
export async function authorizeOrder(paypalOrderId: string): Promise<{
  authorizationId: string;
  order: Order;
}> {
  const resp = await ordersController().authorizeOrder({
    id: paypalOrderId,
    prefer: "return=representation",
  });
  const order = resp.result as Order;
  const authorizationId =
    order.purchaseUnits?.[0]?.payments?.authorizations?.[0]?.id;
  if (!authorizationId) {
    throw new Error("PayPal did not return an authorization id");
  }
  return { authorizationId, order };
}

/** Capture an authorization — releases the held escrow funds. */
export async function captureAuthorization(
  authorizationId: string,
  finalCents?: number,
) {
  const resp = await paymentsController().captureAuthorizedPayment({
    authorizationId,
    body: finalCents
      ? { amount: { currencyCode: "USD", value: centsToApi(finalCents) } }
      : {},
    prefer: "return=representation",
  });
  return resp.result;
}

/** Void an authorization — cancels the escrow hold (full refund). */
export async function voidAuthorization(authorizationId: string) {
  const resp = await paymentsController().voidPayment({
    authorizationId,
    prefer: "return=representation",
  });
  return resp.result;
}

/** Refund a captured payment (dispute resolution). */
export async function refundCapture(captureId: string, cents: number) {
  const resp = await paymentsController().refundCapturedPayment({
    captureId,
    body: { amount: { currencyCode: "USD", value: centsToApi(cents) } },
    prefer: "return=representation",
  });
  return resp.result;
}

// -----------------------------------------------------------------------------
// Payouts API (plain REST — the SDK exposes no controller for it)
// -----------------------------------------------------------------------------

/** Fetch an OAuth access token for direct REST calls. */
export async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${env.paypalClientId}:${env.paypalClientSecret}`,
  ).toString("base64");
  const res = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`PayPal OAuth failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

/**
 * Send the seller's share of a sale via the Payouts API.
 * Used in "payout" split mode — a real money movement visible in both the
 * platform's and the seller's sandbox dashboards.
 */
export async function payoutToSeller(params: {
  sellerEmail: string;
  amountCents: number;
  internalOrderId: string;
  note?: string;
}): Promise<{ batchId: string; status: string }> {
  const token = await getAccessToken();
  const res = await fetch(`${paypalApiBase()}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: `payout-${params.internalOrderId}`,
        recipient_type: "EMAIL",
        email_subject: "You received your marketplace sale proceeds",
        email_message:
          params.note ?? "Your sale on the AI marketplace has been paid out.",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: centsToApi(params.amountCents),
            currency: "USD",
          },
          receiver: params.sellerEmail,
          note: params.note ?? "Marketplace sale payout",
          sender_item_id: params.internalOrderId,
        },
      ],
    }),
  });
  const json = (await res.json()) as {
    batch_header?: { payout_batch_id: string; batch_status: string };
    name?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(
      `Payout failed: ${res.status} ${json.message ?? JSON.stringify(json)}`,
    );
  }
  return {
    batchId: json.batch_header?.payout_batch_id ?? "",
    status: json.batch_header?.batch_status ?? "UNKNOWN",
  };
}

/** Verify a webhook signature against PayPal (basic authenticity check). */
export async function verifyWebhookSignature(params: {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  webhookId: string;
  event: unknown;
}): Promise<boolean> {
  const token = await getAccessToken();
  const res = await fetch(
    `${paypalApiBase()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transmission_id: params.transmissionId,
        transmission_time: params.transmissionTime,
        cert_url: params.certUrl,
        auth_algo: params.authAlgo,
        transmission_sig: params.transmissionSig,
        webhook_id: params.webhookId,
        webhook_event: params.event,
      }),
    },
  );
  const json = (await res.json()) as { verification_status?: string };
  return json.verification_status === "SUCCESS";
}
