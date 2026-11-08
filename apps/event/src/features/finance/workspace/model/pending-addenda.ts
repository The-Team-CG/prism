import type { PrismAddendum } from "@prism/types";

/**
 * Pending addenda whose countersignature will change billing or quote amounts. The totals on the statement and the
 * payment rows stay at their current values until then.
 */
export function pendingBillingAddenda(addenda: readonly PrismAddendum[]): PrismAddendum[] {
  return addenda.filter((addendum) => addendum.status === "pending" && addendum.plannedImpacts !== null
    && (addendum.plannedImpacts.billing !== null || addendum.plannedImpacts.quotes.length > 0));
}

export function pendingBillingAddendumLine(addendum: PrismAddendum): string {
  const delta = addendum.financialDelta === 0 ? "no billing change" : `billing ${addendum.financialDelta > 0 ? "+" : ""}${addendum.financialDelta.toLocaleString("en-PH")}`;
  const quotes = addendum.plannedImpacts?.quotes.length ?? 0;
  const quoteText = quotes === 0 ? "" : `, ${quotes} selected quote${quotes === 1 ? "" : "s"}`;
  return `Addendum v${addendum.versionNumber}: ${delta}${quoteText}. Applied when PMCM countersigns.`;
}
