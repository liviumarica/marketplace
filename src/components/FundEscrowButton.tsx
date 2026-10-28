"use client";

/**
 * FundEscrowButton — PayPal checkout that AUTHORIZES (holds) funds for a
 * custom-order escrow instead of capturing them.
 *
 * createOrder -> our API creates CustomOrder + PayPal order (intent=AUTHORIZE)
 * onApprove   -> our API authorizes the order, holding the buyer's funds
 */
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface FundEscrowButtonProps {
  offerId: string;
  paypalClientId: string;
}

export function FundEscrowButton({
  offerId,
  paypalClientId,
}: FundEscrowButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {/* PayPal's iframe buttons sit on a light card for maximum legibility. */}
      <div className="paypal-frame">
      <PayPalScriptProvider
        options={{
          clientId: paypalClientId,
          currency: "USD",
          locale: "en_US",
          intent: "authorize", // MUST match the order intent — escrow hold
          components: "buttons",
        }}
      >
        <PayPalButtons
          style={{ layout: "horizontal", shape: "rect", height: 35 }}
          createOrder={async () => {
            setError(null);
            const res = await fetch("/api/custom-orders/fund", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ offerId }),
            });
            const json = await res.json();
            if (!res.ok)
              throw new Error(json.error ?? "Could not create escrow order");
            return json.paypalOrderId as string;
          }}
          onApprove={async (data) => {
            const res = await fetch("/api/custom-orders/authorize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paypalOrderId: data.orderID }),
            });
            const json = await res.json();
            if (!res.ok) {
              setError(json.error ?? "Authorization failed");
              return;
            }
            router.push(`/custom-orders/${json.customOrderId}`);
          }}
          onError={(err) => setError(String(err))}
        />
      </PayPalScriptProvider>
      </div>
      {error && <p className="alert-error mt-2 text-xs">{error}</p>}
      <p className="text-dim mt-2 text-xs">
        Funds are held (not charged) until you accept the delivery.
      </p>
    </div>
  );
}
