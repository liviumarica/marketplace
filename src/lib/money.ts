/**
 * Money helpers — all monetary values are stored as integer USD cents to avoid
 * floating point errors. PayPal APIs expect decimal strings ("10.00"), so the
 * conversion lives in exactly one place.
 */

/** Format integer cents as a PayPal-style decimal string: 1050 -> "10.50". */
export function centsToApi(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Format integer cents for display: 1050 -> "$10.50". */
export function formatUsd(cents: number): string {
  return `$${centsToApi(cents)}`;
}

/** Compute the platform commission for a gross amount, in cents. */
export function platformFee(totalCents: number, feeBps: number): number {
  // Round down — the seller share is computed as the remainder so the two
  // legs always add up exactly to the total.
  return Math.floor((totalCents * feeBps) / 10_000);
}
