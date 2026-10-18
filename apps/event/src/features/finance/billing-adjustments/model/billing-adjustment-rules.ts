import type { PrismBillingSource, PrismBillingStatement } from "@prism/types";

/** Client-side guard shown before submit. The shared Zod schemas remain the authority on the request body. */
export function blankReasonError(reason: string, fieldLabel: string): string | null {
  return reason.trim() ? null : `${fieldLabel} is required.`;
}

export function disputeAmountError(amount: number, statement?: Pick<PrismBillingStatement, "totalAmount">): string | null {
  if (!Number.isInteger(amount) || amount <= 0) return "Disputed amount must be a whole number greater than zero.";
  if (statement && amount > statement.totalAmount) return "Disputed amount cannot exceed the statement total.";
  return null;
}

export function paymentWithinBalanceError(amount: number, remainingBalance: number): string | null {
  if (!Number.isInteger(amount) || amount <= 0) return "Payment amount must be a whole number greater than zero.";
  if (amount > remainingBalance) return "Payment amount cannot exceed the remaining milestone balance.";
  return null;
}

/** Additional billing may only be issued against a source PMCM has approved. */
export function approvedBillingSources<T extends Pick<PrismBillingSource, "status">>(sources: readonly T[]): T[] {
  return sources.filter((source) => source.status === "approved");
}
