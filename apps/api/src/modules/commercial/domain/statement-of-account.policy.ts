import type { PrismPaymentSubmission, PrismStatementMilestone, PrismStatementOfAccount, PrismStatementOfAccountLine } from '@prism/types';

export type StatementViewer = 'client' | 'pmcm';

/** A receipt meant for this event, with what it still holds unapplied. */
export interface StatementReceipt {
  id: string;
  amount: number;
  receivedDate: Date;
  method: string;
  referenceNumber: string;
  status: string;
  source: string;
  rejectionReason: string | null;
  intendedMilestoneId: string | null;
  hasProof: boolean;
  /** Left after allocations and refunds. */
  unapplied: number;
  createdAt: Date;
}

export interface StatementInputs {
  viewer: StatementViewer;
  /** The current billing statement. For a client, only one PMCM has sent counts. */
  statement: { number: string; totalAmount: number; sentAt: Date | null; generatedAt: Date; paymentMethods?: unknown } | null;
  /** Current (not replaced) milestones the viewer may see. */
  milestones: Array<{ id: string; label: string; dueDate: Date; amount: number; amountPaid: number; creditApplied: number; remainingBalance: number; status: string }>;
  /** Payment records on those milestones. A negative one carries `reversesRecordId` and undoes that payment. */
  records: Array<{ id: string; milestoneId?: string; receiptId?: string | null; amountReceived: number; paymentDate: Date; paymentMethod: string; referenceNumber: string; reversesRecordId: string | null }>;
  /** Money paid back from receipts held for this event. */
  refunds: Array<{ id: string; amount: number; refundedDate: Date; method: string; referenceNumber: string }>;
  /** Receipts meant for this event: live ones and rejected ones. */
  receipts?: StatementReceipt[];
  /** Disputes still open on the statement, with the payment each names. */
  openDisputes?: Array<{ milestoneId: string | null; amount: number }>;
}

const isoDate = (value: Date) => value.toISOString().slice(0, 10);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** A client sees a statement only once PMCM has sent it; PMCM sees whatever is current. */
function visible(input: StatementInputs): boolean {
  if (!input.statement) return false;
  return input.viewer === 'pmcm' || input.statement.sentAt !== null;
}

function paymentLines(records: StatementInputs['records']): PrismStatementOfAccountLine[] {
  const undone = new Set(records.flatMap((record) => (record.reversesRecordId ? [record.reversesRecordId] : [])));
  return records
    .filter((record) => !record.reversesRecordId)
    .map((record) => ({
      id: record.id,
      date: isoDate(record.paymentDate),
      kind: 'payment' as const,
      description: undone.has(record.id) ? 'Payment received, later reversed by PMCM' : 'Payment received',
      method: record.paymentMethod,
      reference: record.referenceNumber,
      amount: record.amountReceived,
      reversed: undone.has(record.id),
    }));
}

function creditLine(input: StatementInputs, credit: number): PrismStatementOfAccountLine[] {
  if (credit <= 0 || !input.statement) return [];
  const date = input.statement.sentAt ?? input.statement.generatedAt;
  return [{ id: 'credit', date: isoDate(date), kind: 'credit', description: 'Credit carried from an earlier statement', method: '', reference: '', amount: credit, reversed: false }];
}

function refundLines(refunds: StatementInputs['refunds']): PrismStatementOfAccountLine[] {
  return refunds.map((refund) => ({
    id: refund.id, date: isoDate(refund.refundedDate), kind: 'refund' as const, description: 'Refund paid back to you', method: refund.method, reference: refund.referenceNumber, amount: refund.amount, reversed: false,
  }));
}

function paymentMethods(value: unknown): Array<{ label: string; details: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const { label, details } = item as { label?: unknown; details?: unknown };
    return typeof label === 'string' && label.trim() ? [{ label: label.trim(), details: typeof details === 'string' ? details.trim() : '' }] : [];
  });
}

/** Records still counting: a payment that was later reversed, and the reversal itself, both drop out. */
function liveRecords(records: StatementInputs['records']) {
  const undone = new Set(records.flatMap((record) => (record.reversesRecordId ? [record.reversesRecordId] : [])));
  return records.filter((record) => !record.reversesRecordId && !undone.has(record.id));
}

function latestDate(dates: Date[]): Date | null {
  return dates.reduce<Date | null>((latest, date) => (!latest || date > latest ? date : latest), null);
}

/** Per payment: how much came from money PMCM is still checking, what is disputed, and the day it was settled. */
function milestoneFacts(input: StatementInputs): PrismStatementMilestone[] {
  const checkingReceipts = new Set((input.receipts ?? []).filter((receipt) => receipt.status === 'recorded').map((receipt) => receipt.id));
  const live = liveRecords(input.records);
  const disputes = input.openDisputes ?? [];
  return input.milestones.map((milestone) => {
    const own = live.filter((record) => record.milestoneId === milestone.id);
    const lastPayment = latestDate(own.map((record) => record.paymentDate));
    return {
      id: milestone.id,
      label: milestone.label,
      dueDate: isoDate(milestone.dueDate),
      amount: milestone.amount,
      paid: milestone.amountPaid,
      remaining: milestone.remainingBalance,
      status: milestone.status,
      checking: sum(own.filter((record) => record.receiptId && checkingReceipts.has(record.receiptId)).map((record) => record.amountReceived)),
      disputed: sum(disputes.filter((dispute) => dispute.milestoneId === milestone.id).map((dispute) => dispute.amount)),
      settledOn: milestone.remainingBalance <= 0 && lastPayment ? isoDate(lastPayment) : null,
    };
  });
}

const SUBMISSION_STATE: Record<string, PrismPaymentSubmission['state']> = { recorded: 'checking', verified: 'accepted', rejected: 'not_accepted' };

/** Whether the client hears about a receipt: still being checked, not accepted, or reported by them and now accepted. */
function clientShouldSee(receipt: StatementReceipt) {
  return receipt.status === 'recorded' || receipt.status === 'rejected' || (receipt.status === 'verified' && receipt.source === 'client');
}

/**
 * Payments the client should hear about. Payments PMCM recorded and checked already show as payment lines, so they are
 * left out unless the client reported them.
 */
function submissions(input: StatementInputs): PrismPaymentSubmission[] {
  const labels = new Map(input.milestones.map((milestone) => [milestone.id, milestone.label]));
  const appliedTo = new Map<string, string>();
  for (const record of liveRecords(input.records)) {
    const label = record.milestoneId ? labels.get(record.milestoneId) : undefined;
    if (record.receiptId && label && !appliedTo.has(record.receiptId)) appliedTo.set(record.receiptId, label);
  }
  return (input.receipts ?? [])
    .filter(clientShouldSee)
    .sort((a, b) => b.receivedDate.getTime() - a.receivedDate.getTime() || b.createdAt.getTime() - a.createdAt.getTime())
    .map((receipt, index) => ({
      // A client may act on a payment they reported (to add proof), so it carries its id; others carry a position only.
      id: receipt.source === 'client' ? receipt.id : `payment-${index + 1}`,
      amount: receipt.amount,
      paidDate: isoDate(receipt.receivedDate),
      method: receipt.method,
      reference: receipt.referenceNumber,
      state: SUBMISSION_STATE[receipt.status],
      reason: receipt.status === 'rejected' ? receipt.rejectionReason : null,
      forPayment: appliedTo.get(receipt.id) ?? (receipt.intendedMilestoneId ? labels.get(receipt.intendedMilestoneId) ?? null : null),
      unapplied: receipt.status === 'rejected' ? 0 : Math.max(0, receipt.unapplied),
      fromClient: receipt.source === 'client',
      hasProof: receipt.hasProof,
    }));
}

const UNAVAILABLE: Omit<PrismStatementOfAccount, 'eventId' | 'eventName' | 'generatedAt'> = {
  available: false, statementNumber: null, billed: 0, received: 0, refunded: 0, creditHeld: 0, balance: 0, disputedOnStatement: 0, milestones: [], paymentMethods: [], submissions: [], lines: [],
};

/**
 * The statement of account for one event, from the facts alone. A reversed payment is listed and marked but never
 * counted, so what the lines add up to is what the totals say. Nothing internal is carried: no PMCM notes or payers.
 * Unapplied money counts as credit held only once PMCM has checked it; until then it is listed as being checked.
 */
export function buildStatementOfAccount(input: StatementInputs): Omit<PrismStatementOfAccount, 'eventId' | 'eventName' | 'generatedAt'> {
  if (!visible(input) || !input.statement) return { ...UNAVAILABLE, milestones: [], paymentMethods: [], submissions: [], lines: [] };
  const credit = sum(input.milestones.map((milestone) => milestone.creditApplied));
  const lines = [...paymentLines(input.records), ...creditLine(input, credit), ...refundLines(input.refunds)]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return {
    available: true,
    statementNumber: input.statement.number,
    billed: input.statement.totalAmount,
    received: sum(lines.filter((line) => line.kind !== 'refund' && !line.reversed).map((line) => line.amount)),
    refunded: sum(lines.filter((line) => line.kind === 'refund').map((line) => line.amount)),
    creditHeld: sum((input.receipts ?? []).filter((receipt) => receipt.status === 'verified').map((receipt) => Math.max(0, receipt.unapplied))),
    balance: sum(input.milestones.map((milestone) => milestone.remainingBalance)),
    disputedOnStatement: sum((input.openDisputes ?? []).filter((dispute) => !dispute.milestoneId).map((dispute) => dispute.amount)),
    milestones: milestoneFacts(input),
    paymentMethods: paymentMethods(input.statement.paymentMethods),
    submissions: submissions(input),
    lines,
  };
}
