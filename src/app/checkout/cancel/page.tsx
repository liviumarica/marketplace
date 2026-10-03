/**
 * PayPal cancel page — buyer backed out of the PayPal approval flow.
 */
import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">Checkout cancelled</h1>
      <p className="mt-2 text-sm text-slate-600">
        No payment was made. You can return to the marketplace and try again
        whenever you&apos;re ready.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Back to marketplace
      </Link>
    </div>
  );
}
