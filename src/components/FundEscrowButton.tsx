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
      <PayPalScriptProvider
        options={{
          clientId: paypalClientId,
          currency: "USD",
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
      {error && (
        <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
          {error}
        </p>
      )}
      <p className="mt-1 text-xs text-slate-500">
        Funds are held (not charged) until you accept the delivery.
      </p>
    </div>
  );
}
