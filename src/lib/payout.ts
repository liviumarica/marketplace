/**
 * Seller payout readiness.
 *
 * Sellers may publish a listing WITHOUT PayPal details (less friction when
 * starting out), but a buyer can only check out once the seller can actually
 * receive their share — otherwise the money would get stuck on the platform.
 * What "ready" means depends on how the commission is split:
 *   - payout mode     → we pay the seller via the Payouts API → needs paypalEmail
 *   - multi_unit mode → PayPal pays the seller directly       → needs paypalMerchantId
 */
import { env } from "@/lib/env";

interface SellerPayoutFields {
  paypalEmail: string | null;
  paypalMerchantId: string | null;
}

/** True when the seller can receive the proceeds of a sale right now. */
export function isPayoutReady(seller: SellerPayoutFields): boolean {
  return env.paypalSplitMode === "multi_unit"
    ? Boolean(seller.paypalMerchantId)
    : Boolean(seller.paypalEmail);
}

/** Human-readable name of the field the seller still has to fill in. */
export function missingPayoutField(): string {
  return env.paypalSplitMode === "multi_unit" ? "PayPal Merchant ID" : "PayPal email";
}

/** Error shown to a buyer who tries to purchase from a not-ready seller. */
export const SELLER_NOT_PAYOUT_READY =
  "The seller is still setting up payouts, so this listing can't be purchased yet. Book a demo or check back soon.";
