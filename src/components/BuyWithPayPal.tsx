"use client";

/**
 * BuyWithPayPal — the real PayPal checkout for a listing purchase.
 *
 * Flow: PayPal button -> createOrder() calls our API which persists an
 * internal Order + creates the PayPal order (with the commission split) ->
 * buyer approves in the PayPal popup -> onApprove() captures on the server
 * -> redirect to the order/asset-transfer page.
 */
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface BuyWithPayPalProps {
  listingId: string;
  priceLabel: string;
  paypalClientId: string;
}

export function BuyWithPayPal({
  listingId,
  priceLabel,
  paypalClientId,
}: BuyWithPayPalProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <PayPalScriptProvider
        options={{
          clientId: paypalClientId,
          currency: "USD",
          intent: "capture",
          components: "buttons",
        }}
      >
        <PayPalButtons
          style={{ layout: "vertical", shape: "rect" }}
          // Create the internal order + PayPal order when the button asks.
          createOrder={async () => {
            setError(null);
            const res = await fetch("/api/orders/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ listingId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Could not create order");
            return json.paypalOrderId as string;
          }}
          // Buyer approved in the popup — capture the payment server-side.
          onApprove={async (data) => {
            const res = await fetch("/api/orders/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paypalOrderId: data.orderID }),
            });
            const json = await res.json();
            if (!res.ok) {
              setError(json.error ?? "Capture failed");
              return;
            }
            router.push(`/orders/${json.orderId}`);
          }}
          onError={(err) => setError(String(err))}
        />
      </PayPalScriptProvider>
      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="mt-2 text-center text-xs text-slate-500">
        {priceLabel} — payment splits automatically: seller + platform fee
      </p>
    </div>
  );
}
