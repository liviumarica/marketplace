"use client";

/**
 * PayPal return page — the buyer lands here after approving a payment on
 * paypal.com (used by the agent-created checkout links). We capture the
 * order server-side and forward to the order page.
 */
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ReturnHandler() {
  const router = useRouter();
  const params = useSearchParams();
  // PayPal returns the order id as `token` on the return URL.
  const token = params.get("token");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return; // missing-token message is rendered below
    fetch("/api/orders/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paypalOrderId: token }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Capture failed");
        router.replace(`/orders/${json.orderId}`);
      })
      .catch((err) => setStatus(`Could not complete the payment: ${err.message}`));
  }, [token, router]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      <p className="mt-4 text-sm text-slate-600">
        {status ??
          (token
            ? "Finalizing your PayPal payment…"
            : "Missing PayPal order token — nothing to capture.")}
      </p>
    </div>
  );
}

export default function CheckoutReturnPage() {
  return (
    <Suspense>
      <ReturnHandler />
    </Suspense>
  );
}
