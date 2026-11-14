import type { PrismFinanceDesk, PrismFinanceDeskEvent, PrismFinanceDeskItem, PrismFinanceDeskPayout, PrismStatementOfAccount } from '@prism/types';

/** A client payment due within this many days is "due soon". */
export const CLIENT_DUE_SOON_DAYS = 14;
/** A supplier payout due within this many days is "due soon". */
export const SUPPLIER_DUE_SOON_DAYS = 7;

export interface FinanceDeskFacts {
  /** Today's Philippine calendar date, YYYY-MM-DD. */
  today: string;
  events: Array<{ id: string; eventName: string; eventDate: string | null; clientName: string }>;
  /** Each event's current statement as PMCM sees it, with whether the client has it yet. */
  statements: Array<{ statement: PrismStatementOfAccount; sent: boolean }>;
  /** Live and rejected receipts are not needed here: only money still being checked or not yet applied. */
  receipts: Array<{
    id: string; eventId: string | null; amount: number; receivedDate: string; method: string; referenceNumber: string;
    status: 'recorded' | 'verified'; source: 'pmcm' | 'client'; unapplied: number; forPayment: string | null; hasProof: boolean;
  }>;
  disputes: Array<{ id: string; eventId: string; amount: number; reason: string; payment: string | null; raisedOn: string }>;
  corrections: Array<{ id: string; eventId: string; reason: string; requestedOn: string }>;
  draftSources: Array<{ id: string; eventId: string; label: string; amount: number }>;
  unsentStatements: Array<{ id: string; eventId: string; number: string; amount: number }>;
  payouts: PrismFinanceDeskPayout[];
}

const peso = (amount: number) => `₱${Math.max(0, Math.round(amount)).toLocaleString('en-PH')}`;
const shortDate = (iso: string) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const days = (n: number) => (n === 1 ? '1 day' : `${n} days`);

/** Whole days from today to a date: negative once it has passed. */
export function daysFrom(today: string, date: string): number {
  return Math.round((Date.parse(`${date.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

const owed = (milestone: { remaining: number; disputed: number }) => Math.max(0, milestone.remaining - milestone.disputed);

function eventMoney(facts: FinanceDeskFacts, entry: FinanceDeskFacts['statements'][number]): PrismFinanceDeskEvent {
  const { statement } = entry;
  const event = facts.events.find((candidate) => candidate.id === statement.eventId);
  return {
    eventId: statement.eventId,
    eventName: statement.eventName,
    eventDate: event?.eventDate ?? null,
    clientName: event?.clientName ?? '',
    statementNumber: statement.statementNumber,
    statementSent: entry.sent,
    billed: statement.billed,
    paid: sum(statement.milestones.map((milestone) => milestone.paid)),
    checking: sum(statement.milestones.map((milestone) => milestone.checking)),
    balance: statement.balance,
    overdue: sum(statement.milestones.filter((milestone) => daysFrom(facts.today, milestone.dueDate) < 0).map(owed)),
    milestones: statement.milestones,
  };
}

function clientOverdueItems(facts: FinanceDeskFacts, events: PrismFinanceDeskEvent[]): PrismFinanceDeskItem[] {
  return events.flatMap((event) => {
    const late = event.milestones.filter((milestone) => owed(milestone) > 0 && daysFrom(facts.today, milestone.dueDate) < 0);
    if (late.length === 0) return [];
    const first = late[0];
    return [{
      id: `client-overdue:${event.eventId}`, kind: 'client_overdue' as const, severity: 'critical' as const, eventId: event.eventId, eventName: event.eventName,
      title: `${peso(event.overdue)} overdue from ${event.clientName || 'the client'}`,
      detail: `${late.map((milestone) => milestone.label).join(', ')} · due ${shortDate(first.dueDate)} · ${days(-daysFrom(facts.today, first.dueDate))} late`,
      amount: event.overdue, date: first.dueDate, href: `/dashboard/events/${event.eventId}/billing`,
    }];
  });
}

function eventName(facts: FinanceDeskFacts, eventId: string | null) {
  return eventId ? facts.events.find((event) => event.id === eventId)?.eventName ?? null : null;
}

function receiptItems(facts: FinanceDeskFacts): PrismFinanceDeskItem[] {
  return facts.receipts.flatMap((receipt): PrismFinanceDeskItem[] => {
    const base = { eventId: receipt.eventId, eventName: eventName(facts, receipt.eventId), date: receipt.receivedDate, href: `/dashboard/finance/receipts?receipt=${encodeURIComponent(receipt.id)}` };
    if (receipt.status === 'recorded') {
      const parts = [receipt.source === 'client' ? 'Reported by the client' : 'Recorded by PMCM', receipt.referenceNumber ? `Ref ${receipt.referenceNumber}` : 'no reference'];
      if (receipt.forPayment) parts.push(`for ${receipt.forPayment}`);
      parts.push(receipt.hasProof ? 'proof attached' : 'no proof yet');
      return [{ ...base, id: `verify:${receipt.id}`, kind: 'verify_payment' as const, severity: 'warning' as const, title: `Check ${peso(receipt.amount)} ${receipt.method} payment`, detail: parts.join(' · '), amount: receipt.amount }];
    }
    if (receipt.unapplied <= 0) return [];
    return [{ ...base, id: `apply:${receipt.id}`, kind: 'apply_money' as const, severity: 'warning' as const, title: `Apply ${peso(receipt.unapplied)} received`, detail: `Checked, not yet on a payment${receipt.forPayment ? ` · meant for ${receipt.forPayment}` : ''}`, amount: receipt.unapplied }];
  });
}

function adjustmentItems(facts: FinanceDeskFacts): PrismFinanceDeskItem[] {
  const disputes = facts.disputes.map((dispute) => ({
    id: `dispute:${dispute.id}`, kind: 'dispute' as const, severity: 'warning' as const, eventId: dispute.eventId, eventName: eventName(facts, dispute.eventId),
    title: `Answer a ${peso(dispute.amount)} dispute`, detail: `${dispute.payment ?? 'Whole statement'} · raised ${shortDate(dispute.raisedOn)} · “${dispute.reason}”`,
    amount: dispute.amount, date: dispute.raisedOn, href: `/dashboard/events/${dispute.eventId}/billing?part=adjustments`,
  }));
  const corrections = facts.corrections.map((correction) => ({
    id: `correction:${correction.id}`, kind: 'correction' as const, severity: 'warning' as const, eventId: correction.eventId, eventName: eventName(facts, correction.eventId),
    title: 'Review a billing correction', detail: `${correction.reason} · requested ${shortDate(correction.requestedOn)}`,
    amount: 0, date: correction.requestedOn, href: `/dashboard/events/${correction.eventId}/billing?part=adjustments`,
  }));
  return [...disputes, ...corrections];
}

function payoutItems(facts: FinanceDeskFacts): PrismFinanceDeskItem[] {
  return facts.payouts.flatMap((payout) => {
    const remaining = payout.amount - payout.released;
    if (remaining <= 0 || !payout.dueDate) return [];
    const until = daysFrom(facts.today, payout.dueDate);
    if (until > SUPPLIER_DUE_SOON_DAYS) return [];
    const late = until < 0;
    return [{
      id: `payout:${payout.id}`, kind: late ? 'supplier_overdue' as const : 'supplier_due_soon' as const, severity: late ? 'critical' as const : 'warning' as const,
      eventId: payout.eventId, eventName: payout.eventName, title: `Pay ${payout.supplierName} ${peso(remaining)}`,
      detail: `${payout.label} · due ${shortDate(payout.dueDate)} · ${late ? `${days(-until)} late` : until === 0 ? 'today' : `in ${days(until)}`}`,
      amount: remaining, date: payout.dueDate, href: `/dashboard/events/${payout.eventId}/suppliers`,
    }];
  });
}

function setupItems(facts: FinanceDeskFacts): PrismFinanceDeskItem[] {
  const sources = facts.draftSources.map((source) => ({
    id: `source:${source.id}`, kind: 'approve_source' as const, severity: 'info' as const, eventId: source.eventId, eventName: eventName(facts, source.eventId),
    title: 'Approve a billing source', detail: `${source.label} · ${peso(source.amount)}`, amount: source.amount, date: null, href: `/dashboard/events/${source.eventId}/billing?part=sources`,
  }));
  const unsent = facts.unsentStatements.map((statement) => ({
    id: `send:${statement.id}`, kind: 'send_statement' as const, severity: 'info' as const, eventId: statement.eventId, eventName: eventName(facts, statement.eventId),
    title: `Send statement ${statement.number}`, detail: `${peso(statement.amount)} · the client cannot see it or pay against it yet`, amount: statement.amount, date: null, href: `/dashboard/events/${statement.eventId}/billing`,
  }));
  return [...sources, ...unsent];
}

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 } as const;

function byUrgency(a: PrismFinanceDeskItem, b: PrismFinanceDeskItem) {
  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.id.localeCompare(b.id);
}

function totals(facts: FinanceDeskFacts, events: PrismFinanceDeskEvent[]): PrismFinanceDesk['totals'] {
  const open = events.flatMap((event) => event.milestones).filter((milestone) => owed(milestone) > 0);
  const until = (milestone: { dueDate: string }) => daysFrom(facts.today, milestone.dueDate);
  const payoutsOpen = facts.payouts.filter((payout) => payout.amount > payout.released && payout.dueDate);
  const toVerify = facts.receipts.filter((receipt) => receipt.status === 'recorded');
  return {
    clientOverdue: sum(open.filter((milestone) => until(milestone) < 0).map(owed)),
    clientDueSoon: sum(open.filter((milestone) => until(milestone) >= 0 && until(milestone) <= CLIENT_DUE_SOON_DAYS).map(owed)),
    toVerify: sum(toVerify.map((receipt) => receipt.amount)),
    toVerifyCount: toVerify.length,
    unapplied: sum(facts.receipts.map((receipt) => Math.max(0, receipt.unapplied))),
    openDisputes: facts.disputes.length,
    pendingCorrections: facts.corrections.length,
    supplierOverdue: sum(payoutsOpen.filter((payout) => daysFrom(facts.today, payout.dueDate!) < 0).map((payout) => payout.amount - payout.released)),
    supplierDueSoon: sum(payoutsOpen.filter((payout) => { const n = daysFrom(facts.today, payout.dueDate!); return n >= 0 && n <= SUPPLIER_DUE_SOON_DAYS; }).map((payout) => payout.amount - payout.released)),
  };
}

/** Events with money out first (most overdue first), then by the next payment due. */
function byAttention(a: PrismFinanceDeskEvent, b: PrismFinanceDeskEvent) {
  const next = (event: PrismFinanceDeskEvent) => event.milestones.find((milestone) => owed(milestone) > 0)?.dueDate ?? '9999';
  return b.overdue - a.overdue || next(a).localeCompare(next(b)) || a.eventName.localeCompare(b.eventName);
}

/** Finance across every active event, from the facts alone: what needs PMCM, in order, and where each event's money stands. */
export function buildFinanceDesk(facts: FinanceDeskFacts, generatedAt: string): PrismFinanceDesk {
  const events = facts.statements.filter((entry) => entry.statement.available).map((entry) => eventMoney(facts, entry)).sort(byAttention);
  const queue = [...clientOverdueItems(facts, events), ...receiptItems(facts), ...adjustmentItems(facts), ...payoutItems(facts), ...setupItems(facts)].sort(byUrgency);
  return { generatedAt, totals: totals(facts, events), queue, events, payouts: facts.payouts };
}
