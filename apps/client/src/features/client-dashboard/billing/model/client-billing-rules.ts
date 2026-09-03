export function clientMilestoneRemaining(payment: {
  amount: number;
  amountPaid?: number;
  remainingBalance?: number;
}) {
  if (typeof payment.remainingBalance === "number") return payment.remainingBalance;
  return Math.max(0, payment.amount - (payment.amountPaid ?? 0));
}

export function clientMilestoneFollowUpCopy(remaining: number) {
  if (remaining <= 0) return "This milestone is settled.";
  return "Remaining balance is still due. Partial payments stay on record until this milestone is paid in full.";
}
