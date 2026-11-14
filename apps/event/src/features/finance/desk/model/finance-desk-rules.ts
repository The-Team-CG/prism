import type { PrismFinanceDeskEvent, PrismFinanceDeskItemKind, PrismFinanceDeskPayout, PrismStatementMilestone } from "@prism/types";
import { daysUntil, formatPortalDate } from "@prism/ui/format-date";
import { formatPeso, paymentStepState, type PaymentStep } from "@prism/ui/payment-track";

const dayWord = (days: number) => (days === 1 ? "1 day" : `${days} days`);
const owed = (milestone: PrismStatementMilestone) => Math.max(0, milestone.remaining - milestone.disputed);

function when(milestone: PrismStatementMilestone, state: PaymentStep["state"], todayKey: string): string {
  if (state === "paid") return milestone.settledOn ? `Paid ${formatPortalDate(milestone.settledOn)}` : "Paid in full";
  const due = `Due ${formatPortalDate(milestone.dueDate)}`;
  const days = daysUntil(milestone.dueDate, todayKey);
  if (days === null || state === "checking") return due;
  if (days < 0) return `${due} · ${dayWord(-days)} late`;
  return days <= 14 ? `${due} · ${days === 0 ? "today" : `in ${dayWord(days)}`}` : due;
}

/** One client payment as PMCM reads it: what is left, what still has to be verified, what the client questions. */
export function financeStep(milestone: PrismStatementMilestone, todayKey: string): PaymentStep {
  const state = paymentStepState(milestone, daysUntil(milestone.dueDate, todayKey));
  const notes: string[] = [];
  if (milestone.checking > 0) notes.push(`${formatPeso(milestone.checking)} to verify`);
  if (milestone.disputed > 0) notes.push(`${formatPeso(milestone.disputed)} disputed`);
  if (milestone.remaining > 0 && milestone.paid > 0) notes.push(`${formatPeso(milestone.remaining)} still owed`);
  return { id: milestone.id, label: milestone.label, amount: milestone.amount, paid: milestone.paid, checking: milestone.checking, state, when: when(milestone, state, todayKey), notes };
}

export type FinanceTone = "danger" | "attention" | "info" | "success" | "neutral";

/** The one line for an event's money: overdue, else next due, else paid (and whether it is still being verified). */
export function financeHeadline(event: PrismFinanceDeskEvent, todayKey: string): { tone: FinanceTone; title: string; detail: string } {
  if (!event.statementSent) return { tone: "attention", title: "Statement not sent", detail: `${formatPeso(event.billed)} billed; the client cannot see or pay it yet.` };
  if (event.overdue > 0) {
    const late = event.milestones.find((milestone) => owed(milestone) > 0 && (daysUntil(milestone.dueDate, todayKey) ?? 0) < 0);
    return { tone: "danger", title: `${formatPeso(event.overdue)} overdue`, detail: late ? `${late.label} was due ${formatPortalDate(late.dueDate)}.` : "" };
  }
  const next = event.milestones.find((milestone) => owed(milestone) > 0);
  if (next) {
    const days = daysUntil(next.dueDate, todayKey) ?? 99;
    return { tone: days <= 14 ? "attention" : "neutral", title: `${formatPeso(owed(next))} due ${formatPortalDate(next.dueDate)}`, detail: `${next.label}${event.checking > 0 ? ` · ${formatPeso(event.checking)} received still to verify` : ""}.` };
  }
  if (event.checking > 0) return { tone: "info", title: "Paid, verifying", detail: `${formatPeso(event.checking)} still to check against the bank or wallet statement.` };
  return { tone: "success", title: "Paid in full", detail: `${formatPeso(event.paid)} received and verified.` };
}

export type PayoutState = "paid" | "overdue" | "due-soon" | "partly" | "upcoming";

/** Where a supplier payout stands: paid out, late, due within a week, part paid, or later. */
export function payoutState(payout: PrismFinanceDeskPayout, todayKey: string): PayoutState {
  if (payout.released >= payout.amount) return "paid";
  const days = payout.dueDate ? daysUntil(payout.dueDate, todayKey) : null;
  if (days !== null && days < 0) return "overdue";
  if (days !== null && days <= 7) return "due-soon";
  return payout.released > 0 ? "partly" : "upcoming";
}

/** Short label for each kind of work in the queue, used to group and to name its icon. */
export const QUEUE_KIND_LABEL: Record<PrismFinanceDeskItemKind, string> = {
  client_overdue: "Client overdue",
  verify_payment: "Verify",
  apply_money: "Apply",
  dispute: "Dispute",
  correction: "Correction",
  supplier_overdue: "Supplier late",
  supplier_due_soon: "Supplier due",
  approve_source: "Approve",
  send_statement: "Send",
};
