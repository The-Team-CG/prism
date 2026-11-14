import type { PrismBillingStatement, PrismEvent, PrismFinanceDeskEvent, PrismPaymentReceipt, PrismStatementOfAccount } from "@prism/types";
import { daysUntil } from "@prism/ui/format-date";

/** One event's money in the same shape the finance desk uses, so the event page and the desk read alike. */
export function eventMoney(statement: PrismStatementOfAccount, billing: PrismBillingStatement | undefined, event: PrismEvent, todayKey: string): PrismFinanceDeskEvent {
  const owed = (milestone: PrismStatementOfAccount["milestones"][number]) => Math.max(0, milestone.remaining - milestone.disputed);
  return {
    eventId: event.id,
    eventName: event.eventName,
    eventDate: event.eventDate ?? null,
    clientName: event.clientName,
    statementNumber: statement.statementNumber,
    statementSent: Boolean(billing?.sentAt),
    billed: statement.billed,
    paid: statement.milestones.reduce((sum, milestone) => sum + milestone.paid, 0),
    checking: statement.milestones.reduce((sum, milestone) => sum + milestone.checking, 0),
    balance: statement.balance,
    overdue: statement.milestones.filter((milestone) => (daysUntil(milestone.dueDate, todayKey) ?? 0) < 0).reduce((sum, milestone) => sum + owed(milestone), 0),
    milestones: statement.milestones,
  };
}

export type RecordCheck = { state: "verified" | "to-verify" | "not-counted" | "legacy"; receiptId: string | null };

/** Whether a payment applied to a milestone has been checked: by the receipt it came from. Older payments have none. */
export function recordCheck(receiptId: string | null | undefined, receipts: Map<string, PrismPaymentReceipt>): RecordCheck {
  if (!receiptId) return { state: "legacy", receiptId: null };
  const receipt = receipts.get(receiptId);
  if (!receipt) return { state: "legacy", receiptId };
  if (receipt.status === "verified") return { state: "verified", receiptId };
  if (receipt.status === "recorded") return { state: "to-verify", receiptId };
  return { state: "not-counted", receiptId };
}
