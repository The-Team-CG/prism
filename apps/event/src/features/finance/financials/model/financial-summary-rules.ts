import type { PrismEventFinancialSummary } from "@prism/types";

type StatTone = "neutral" | "attention" | "urgent";

/** A margin figure with its sign spelled out, so a loss is never mistaken for a gain: "+₱60,000" or "−₱10,000". */
export function signedAmount(value: number, format: (amount: number) => string): string {
  if (value === 0) return format(0);
  return `${value > 0 ? "+" : "−"}${format(Math.abs(value))}`;
}

/** Only a loss is called out; a healthy margin is just a number. */
export function marginTone(value: number | null): StatTone {
  return value !== null && value < 0 ? "urgent" : "neutral";
}

/** Which price an expected margin was measured against, in the words finance would use. */
export function marginBasisLabel(basis: PrismEventFinancialSummary["margin"]["basis"]): string {
  if (basis === "statement") return "Billing statement less committed supplier cost";
  if (basis === "estimate") return "Proposal estimate less committed supplier cost (no statement yet)";
  return "No price yet";
}

/**
 * How much of what was received is backed by a verified receipt, as a plain sentence. Collecting is not the same as
 * checking: money applied from receipts nobody verified against a statement is the number finance has to chase.
 */
export function receivedTrustDetail(collections: PrismEventFinancialSummary["collections"], format: (amount: number) => string): string {
  if (collections.received === 0) return "Nothing received yet";
  if (collections.unverifiedReceived === 0) return "All verified against a statement";
  return `${format(collections.unverifiedReceived)} not yet verified`;
}

export function overdueDetail(collections: PrismEventFinancialSummary["collections"], format: (amount: number) => string): string | undefined {
  return collections.overdue > 0 ? `${format(collections.overdue)} past due` : undefined;
}

/** Categories where committed supplier cost already exceeds what the proposal estimated for them. */
export function categoriesOverEstimate(summary: PrismEventFinancialSummary): string[] {
  return summary.categories.filter((line) => line.expectedMargin < 0).map((line) => line.category);
}
