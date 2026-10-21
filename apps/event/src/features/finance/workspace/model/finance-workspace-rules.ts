/** Pure finance domain rules (no React / I/O). */

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
