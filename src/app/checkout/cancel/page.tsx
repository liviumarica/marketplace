/**
 * PayPal cancel page — buyer backed out of the PayPal approval flow.
 */
import Link from "next/link";
import { PageTransition } from "@/components/fx/PageTransition";

export default function CheckoutCancelPage() {
  return (
    <PageTransition>
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <div className="glass-strong w-full rounded-3xl p-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xl text-white/70">
            ✕
          </span>
          <h1 className="mt-6 text-2xl font-bold text-white">Checkout cancelled</h1>
          <p className="text-muted mt-3 text-sm">
            No payment was made. You can return to the marketplace and try again
            whenever you&apos;re ready.
          </p>
          <Link href="/" className="btn-primary mt-8">
            Back to marketplace
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}
