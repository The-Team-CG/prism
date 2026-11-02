/** Pure finance domain rules (no React / I/O). */
import { daysUntil, manilaCalendarKey, manilaDateKey } from "@prism/ui/format-date";

/**
 * Whole Philippine calendar days a milestone is past due, or 0 when it is paid, waived, or not yet due.
 * Uses the same day count as the Inbox's "Overdue N days" so both screens agree.
 */
export function paymentOverdueDays(status: string, dueDate: string, now: Date = new Date()): number {
  if (status === "paid" || status === "waived") return 0;
  if (!Number.isFinite(Date.parse(dueDate))) return 0;
  const days = daysUntil(manilaCalendarKey(dueDate), manilaDateKey(now));
  return days !== null && days < 0 ? -days : 0;
}

/** Milestones in the order they fall due; undated milestones sort last. */
export function sortPaymentsByDueDate<T extends { dueDate: string }>(payments: T[]): T[] {
  const time = (value: string) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  };
  return [...payments].sort((a, b) => time(a.dueDate) - time(b.dueDate));
}

export function isPaymentOverdue(
  status: string,
  dueDate: string,
  now: Date = new Date(),
): boolean {
  if (status === "paid" || status === "waived") return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < now.getTime();
}

export function sumPaymentAmounts(
  payments: Array<{
    amount: number;
    amountPaid: number;
    remainingBalance: number;
    status: string;
  }>,
) {
  return {
    totalDue: payments.reduce((s, p) => s + p.amount, 0),
    totalPaid: payments.reduce((s, p) => s + p.amountPaid, 0),
    totalRemaining: payments.reduce((s, p) => s + p.remainingBalance, 0),
    openMilestones: payments.filter((p) => p.status !== "paid").length,
  };
}

export function parseRecordPaymentAmount(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function countNoun(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function remainingPaymentCopy(atRisk: boolean) {
  return atRisk ? "Payment at risk" : "Manual tracker";
}

export function paymentHistoryLabel(count: number) {
  if (count === 0) return "No payment history.";
  return `${count} record${count === 1 ? "" : "s"}`;
}
