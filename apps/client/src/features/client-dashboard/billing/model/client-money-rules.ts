import type { PrismStatementMilestone, PrismStatementOfAccount } from "@prism/types";
import { daysUntil, formatPortalDate } from "@prism/ui/format-date";
import { formatPeso, type PaymentStep, type PaymentStepState } from "@prism/ui/payment-track";

/** A payment due within this many days is "due soon": worth acting on now, not later. */
export const DUE_SOON_DAYS = 14;

/** What is still owed on a payment once money under review and disputed amounts are set aside. */
export function owedNow(milestone: Pick<PrismStatementMilestone, "remaining" | "disputed">): number {
  return Math.max(0, milestone.remaining - milestone.disputed);
}

function dayWord(days: number) {
  return days === 1 ? "1 day" : `${days} days`;
}

function openState(milestone: PrismStatementMilestone, days: number | null): PaymentStepState {
  if (days !== null && days < 0) return owedNow(milestone) > 0 ? "overdue" : "disputed";
  if (milestone.disputed > 0 && owedNow(milestone) === 0) return "disputed";
  if (days !== null && days <= DUE_SOON_DAYS) return "due-soon";
  return milestone.paid > 0 ? "partly" : "upcoming";
}

/** Where one payment stands, from the client's side. Money still being checked counts toward it but is marked. */
export function milestoneState(milestone: PrismStatementMilestone, todayKey: string): PaymentStepState {
  if (milestone.remaining <= 0) return milestone.checking > 0 ? "checking" : "paid";
  return openState(milestone, daysUntil(milestone.dueDate, todayKey));
}

/** When it is due, in words: "Due Nov 18 · in 4 days", "Due Oct 19 · 26 days late", "Paid Oct 13". */
export function milestoneWhen(milestone: PrismStatementMilestone, state: PaymentStepState, todayKey: string): string {
  if (state === "paid") return milestone.settledOn ? `Paid ${formatPortalDate(milestone.settledOn)}` : "Paid in full";
  const due = `Due ${formatPortalDate(milestone.dueDate)}`;
  const days = daysUntil(milestone.dueDate, todayKey);
  if (days === null || state === "checking") return due;
  if (days < 0) return `${due} · ${dayWord(-days)} late`;
  if (days === 0) return `${due} · today`;
  return days <= DUE_SOON_DAYS ? `${due} · in ${dayWord(days)}` : due;
}

function milestoneNotes(milestone: PrismStatementMilestone): string[] {
  const notes: string[] = [];
  if (milestone.checking > 0) notes.push(`${formatPeso(milestone.checking)} being checked by PMCM`);
  if (milestone.disputed > 0) notes.push(`${formatPeso(milestone.disputed)} under review`);
  if (milestone.remaining > 0 && milestone.paid > 0) notes.push(`${formatPeso(milestone.remaining)} left to pay`);
  return notes;
}

export function milestoneStep(milestone: PrismStatementMilestone, todayKey: string): PaymentStep {
  const state = milestoneState(milestone, todayKey);
  return {
    id: milestone.id,
    label: milestone.label,
    amount: milestone.amount,
    paid: milestone.paid,
    checking: milestone.checking,
    state,
    when: milestoneWhen(milestone, state, todayKey),
    notes: milestoneNotes(milestone),
  };
}

export type MoneyTone = "danger" | "attention" | "info" | "success" | "neutral";
export type MoneyHeadline = { tone: MoneyTone; title: string; detail: string; milestoneId: string | null };

function checkingTotal(statement: PrismStatementOfAccount) {
  return statement.submissions.filter((submission) => submission.state === "checking").reduce((sum, submission) => sum + submission.unapplied, 0);
}

function overdueHeadline(overdue: PrismStatementMilestone[], statement: PrismStatementOfAccount): MoneyHeadline {
  const amount = overdue.reduce((sum, milestone) => sum + owedNow(milestone), 0);
  const disputed = overdue.reduce((sum, milestone) => sum + milestone.disputed, 0);
  const first = overdue[0];
  const parts = [`${first.label} was due ${formatPortalDate(first.dueDate)}`];
  if (disputed > 0) parts.push(`${formatPeso(disputed)} more is under review`);
  const checking = checkingTotal(statement);
  if (checking > 0) parts.push(`${formatPeso(checking)} you sent is being checked`);
  return { tone: "danger", title: `${formatPeso(amount)} overdue`, detail: `${parts.join(" · ")}.`, milestoneId: first.id };
}

function nextHeadline(next: PrismStatementMilestone, statement: PrismStatementOfAccount, todayKey: string): MoneyHeadline {
  const days = daysUntil(next.dueDate, todayKey) ?? Number.POSITIVE_INFINITY;
  const checking = checkingTotal(statement);
  const credit = statement.creditHeld;
  const toward = checking > 0
    ? ` ${formatPeso(checking)} you sent is being checked and will count toward it.`
    : credit > 0 ? ` ${formatPeso(credit)} PMCM is holding for you will count toward it.` : "";
  return {
    tone: days <= DUE_SOON_DAYS ? "attention" : "neutral",
    title: `${formatPeso(owedNow(next))} due ${formatPortalDate(next.dueDate)}`,
    detail: `${next.label}${days <= DUE_SOON_DAYS ? `, ${days === 0 ? "today" : `in ${dayWord(days)}`}` : ""}.${toward}`,
    milestoneId: next.id,
  };
}

function settledHeadline(statement: PrismStatementOfAccount): MoneyHeadline {
  const checking = statement.milestones.reduce((sum, milestone) => sum + milestone.checking, 0);
  if (checking > 0) return { tone: "info", title: "Fully paid, being checked", detail: `PMCM is matching ${formatPeso(checking)} against their bank or wallet statement.`, milestoneId: null };
  const last = statement.milestones.map((milestone) => milestone.settledOn ?? "").sort().pop();
  return { tone: "success", title: "Paid in full", detail: last ? `Last payment ${formatPortalDate(last)}. Thank you.` : "Nothing more is due.", milestoneId: null };
}

/** The one line the client reads first: what is overdue, else what is due next, else that everything is paid. */
export function moneyHeadline(statement: PrismStatementOfAccount, todayKey: string): MoneyHeadline | null {
  if (!statement.available || statement.milestones.length === 0) return null;
  const open = statement.milestones.filter((milestone) => owedNow(milestone) > 0);
  const overdue = open.filter((milestone) => (daysUntil(milestone.dueDate, todayKey) ?? 0) < 0);
  if (overdue.length > 0) return overdueHeadline(overdue, statement);
  if (open.length > 0) return nextHeadline(open[0], statement, todayKey);
  if (statement.milestones.some((milestone) => milestone.disputed > 0)) {
    return { tone: "attention", title: "Under review", detail: "PMCM is reviewing the amount you questioned. Nothing else is due.", milestoneId: null };
  }
  return settledHeadline(statement);
}

export type AccountGroupId = "overdue" | "due-soon" | "later" | "paid";
/** One payment in the account view. `owed` is what is still to pay on it, leaving out amounts under review. */
export type AccountPayment = { eventId: string; eventName: string; step: PaymentStep; dueDate: string; owed: number };
export type AccountGroup = { id: AccountGroupId; title: string; payments: AccountPayment[]; total: number };

const GROUP_TITLES: Record<AccountGroupId, string> = { overdue: "Overdue", "due-soon": "Due in the next two weeks", later: "Later", paid: "Paid" };

function groupOf(state: PaymentStepState): AccountGroupId {
  if (state === "overdue") return "overdue";
  if (state === "due-soon" || state === "disputed") return "due-soon";
  if (state === "paid" || state === "checking") return "paid";
  return "later";
}

/** Every payment across the client's events, grouped by when it needs them, soonest first within each group. */
export function accountGroups(statements: PrismStatementOfAccount[], todayKey: string): AccountGroup[] {
  const groups = new Map<AccountGroupId, AccountPayment[]>((Object.keys(GROUP_TITLES) as AccountGroupId[]).map((id) => [id, []]));
  for (const statement of statements.filter((item) => item.available)) {
    for (const milestone of statement.milestones) {
      const step = milestoneStep(milestone, todayKey);
      groups.get(groupOf(step.state))!.push({ eventId: statement.eventId, eventName: statement.eventName, step, dueDate: milestone.dueDate, owed: owedNow(milestone) });
    }
  }
  return [...groups.entries()].map(([id, payments]) => {
    const sorted = [...payments].sort((a, b) => (id === "paid" ? b.dueDate.localeCompare(a.dueDate) : a.dueDate.localeCompare(b.dueDate)));
    const total = sorted.reduce((sum, payment) => sum + (id === "paid" ? payment.step.paid : payment.owed), 0);
    return { id, title: GROUP_TITLES[id], payments: sorted, total };
  });
}

/** Totals across every event: billed, paid so far and still to pay. */
export function accountTotals(statements: PrismStatementOfAccount[]) {
  const available = statements.filter((statement) => statement.available);
  return {
    billed: available.reduce((sum, statement) => sum + statement.billed, 0),
    paid: available.reduce((sum, statement) => sum + statement.milestones.reduce((total, milestone) => total + milestone.paid, 0), 0),
    balance: available.reduce((sum, statement) => sum + statement.balance, 0),
  };
}
