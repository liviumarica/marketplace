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
      {/* Orbiting "processing" loader: two counter-spinning neon arcs. */}
      <div className="relative h-20 w-20">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-cyan-300 border-r-violet-400 shadow-[0_0_30px_rgba(139,92,246,0.6)]" />
        <span className="absolute inset-3 animate-[spin_1.6s_linear_infinite_reverse] rounded-full border-2 border-transparent border-b-fuchsia-400 border-l-cyan-300" />
        <span className="absolute inset-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 blur-[2px]" />
      </div>
      <p className="eyebrow mt-8">PayPal</p>
      <p className="text-muted mt-3 text-sm">
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
