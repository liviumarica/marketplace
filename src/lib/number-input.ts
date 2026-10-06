/**
 * Helpers for numeric form fields (prices, budgets, day counts).
 *
 * `<input type="number">` happily accepts scientific notation and signs
 * ("e1", "1e5", "-3", "+2") because they are valid floating-point syntax —
 * but no human means "e1" as a price. These helpers block those keys while
 * typing and validate the final value with a clear, human message.
 */
import type { KeyboardEvent } from "react";

/** Keys that are legal in a float literal but never wanted in a money/day field. */
const BLOCKED_KEYS = new Set(["e", "E", "+", "-"]);

/** onKeyDown for decimal fields (prices): blocks e/E/+/-. */
export function blockNonDecimalKeys(e: KeyboardEvent<HTMLInputElement>): void {
  if (BLOCKED_KEYS.has(e.key)) e.preventDefault();
}

/** onKeyDown for whole-number fields (budgets, days): also blocks , and . */
export function blockNonIntegerKeys(e: KeyboardEvent<HTMLInputElement>): void {
  if (BLOCKED_KEYS.has(e.key) || e.key === "." || e.key === ",") e.preventDefault();
}

/**
 * Parse a USD amount typed by a user into integer cents.
 * Returns an error message instead when the value is empty, not a plain
 * decimal number (max 2 decimals) or outside [minUsd, maxUsd].
 */
export function parseUsdToCents(
  raw: string,
  {
    minUsd = 1,
    maxUsd = 10_000_000,
    label = "price",
  }: { minUsd?: number; maxUsd?: number; label?: string } = {},
): { cents: number } | { error: string } {
  const value = raw.trim();
  // Plain digits with an optional 1-2 digit decimal part — no exponent/sign.
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return { error: `Enter the ${label} as a plain number in USD, e.g. 499 or 1499.99.` };
  }
  const usd = Number(value);
  if (usd < minUsd) return { error: `The ${label} must be at least $${minUsd}.` };
  if (usd > maxUsd) return { error: `The ${label} can't be more than $${maxUsd.toLocaleString("en-US")}.` };
  return { cents: Math.round(usd * 100) };
}

/** Parse a whole number of days in [1, maxDays], or return an error message. */
export function parseDays(raw: string, maxDays = 365): { days: number } | { error: string } {
  const value = raw.trim();
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maxDays) {
    return { error: `Enter a whole number of days between 1 and ${maxDays}.` };
  }
  return { days: Number(value) };
}
