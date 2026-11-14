import type { PrismPaymentRecord } from "@prism/types";

/**
 * What a client sees of a milestone's payments. A reversal is PMCM undoing a payment it had applied, so it is never
 * listed itself: the payment it undid is listed as reversed, with no receipt, and no negative amount or reason shows.
 */
export function clientPaymentLines(history: PrismPaymentRecord[]) {
  const undone = new Set(history.flatMap((record) => (record.reversesRecordId ? [record.reversesRecordId] : [])));
  return history.filter((record) => !record.reversesRecordId).map((record) => ({ record, reversed: undone.has(record.id) }));
}

export function clientMilestoneRemaining(payment: {
  amount: number;
  amountPaid?: number;
  remainingBalance?: number;
}) {
  if (typeof payment.remainingBalance === "number") return payment.remainingBalance;
  return Math.max(0, payment.amount - (payment.amountPaid ?? 0));
}

/** Payments still owed and past their due date, for the Billing badge. Replaced payments do not count. */
export function overduePaymentCount(payments: Array<{ eventId: string; dueDate: string; remainingBalance: number; supersededAt?: string | null }>, todayKey: string, eventId?: string): number {
  return payments.filter((payment) => !payment.supersededAt && payment.remainingBalance > 0 && payment.dueDate.slice(0, 10) < todayKey && (!eventId || payment.eventId === eventId)).length;
}
