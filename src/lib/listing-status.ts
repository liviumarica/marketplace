/**
 * Human-readable labels for listing states.
 *
 * The database stores terse enums (ACTIVE, PENDING_REVIEW, NONE, PASSED…);
 * showing those raw ("AI verification: NONE") confuses sellers. Every UI
 * that displays a status goes through these helpers instead.
 */

/** Visual tone → chip class used by the design system. */
export type StatusTone = "green" | "amber" | "rose" | "neutral";

export interface StatusLabel {
  label: string;
  tone: StatusTone;
  /** One-sentence explanation, used as tooltip / helper text. */
  hint: string;
}

/** Map a tone to the matching `chip-*` CSS class. */
export function toneClass(tone: StatusTone): string {
  return tone === "neutral" ? "" : `chip-${tone}`;
}

/** Marketplace status of a listing. */
export function listingStatusLabel(status: string): StatusLabel {
  switch (status) {
    case "ACTIVE":
      return { label: "Live", tone: "green", hint: "Visible in the marketplace and open for purchase." };
    case "PENDING_REVIEW":
      return { label: "In review", tone: "amber", hint: "Goes live automatically once AI verification passes." };
    case "SOLD":
      return { label: "Sold", tone: "neutral", hint: "Purchased — no longer for sale." };
    case "DRAFT":
      return { label: "Draft", tone: "neutral", hint: "Only visible to you." };
    default:
      return { label: status, tone: "neutral", hint: "" };
  }
}

/** Result of the KERNEL AI verification agent. */
export function verificationLabel(status: string, score?: number | null): StatusLabel {
  switch (status) {
    case "PASSED":
      return {
        label: `AI verified${score != null ? ` · ${score}/100` : ""}`,
        tone: "green",
        hint: "An AI agent opened the demo in a real browser, tested it and scored it.",
      };
    case "RUNNING":
      return { label: "Verifying…", tone: "amber", hint: "The AI agent is testing the demo right now (a few minutes)." };
    case "FAILED":
      return {
        label: "Verification failed",
        tone: "rose",
        hint: "The agent couldn't confirm the demo works — see the report on the listing page and retry.",
      };
    default:
      return {
        label: "Not verified",
        tone: "neutral",
        hint: "Optional. Listings with a live demo URL can be tested by the AI agent to earn an “AI verified” badge.",
      };
  }
}
