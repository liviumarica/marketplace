/**
 * POST /api/paypal/webhook
 * PayPal webhook receiver. Verifies the transmission signature against
 * PayPal, then reconciles order state — mostly belt-and-suspenders since
 * captures are handled synchronously, but it makes the integration robust
 * (e.g. async payout status, disputes, refunds).
 *
 * Unsigned events are never trusted: without PAYPAL_WEBHOOK_ID the endpoint
 * refuses every request, so nobody can forge a PAYMENT.CAPTURE.COMPLETED.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/paypal";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  const event = await req.json();

  const ok = await verifyWebhookSignature({
    transmissionId: req.headers.get("paypal-transmission-id") ?? "",
    transmissionTime: req.headers.get("paypal-transmission-time") ?? "",
    certUrl: req.headers.get("paypal-cert-url") ?? "",
    authAlgo: req.headers.get("paypal-auth-algo") ?? "",
    transmissionSig: req.headers.get("paypal-transmission-sig") ?? "",
    webhookId,
    event,
  });
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  const type: string = event.event_type ?? "";

  // Reconcile listing-purchase orders.
  if (type === "PAYMENT.CAPTURE.COMPLETED") {
    const orderId: string | undefined =
      event.resource?.supplementary_data?.related_ids?.order_id;
    if (orderId) {
      await prisma.order.updateMany({
        where: { paypalOrderId: orderId, status: "PENDING" },
        data: {
          status: "PAID",
          paypalCaptureId: event.resource?.id ?? null,
        },
      });
    }
  }

  // Log payout batch results — useful to demo the money trail.
  if (type.startsWith("PAYMENT.PAYOUTS-ITEM")) {
    console.log(
      `Payout event ${type}:`,
      JSON.stringify(event.resource).slice(0, 500),
    );
  }

  return NextResponse.json({ received: true, env: env.paypalEnv });
}
