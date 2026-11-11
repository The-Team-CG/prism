import type { PrismStatementOfAccount, PrismStatementOfAccountLine } from '@prism/types';

export type StatementViewer = 'client' | 'pmcm';

export interface StatementInputs {
  viewer: StatementViewer;
  /** The current billing statement. For a client, only one PMCM has sent counts. */
  statement: { number: string; totalAmount: number; sentAt: Date | null; generatedAt: Date } | null;
  /** Current (not replaced) milestones the viewer may see. */
  milestones: Array<{ id: string; label: string; dueDate: Date; amount: number; amountPaid: number; creditApplied: number; remainingBalance: number; status: string }>;
  /** Payment records on those milestones. A negative one carries `reversesRecordId` and undoes that payment. */
  records: Array<{ id: string; amountReceived: number; paymentDate: Date; paymentMethod: string; referenceNumber: string; reversesRecordId: string | null }>;
  /** Money paid back from receipts held for this event. */
  refunds: Array<{ id: string; amount: number; refundedDate: Date; method: string; referenceNumber: string }>;
  /** Unapplied money still held, per receipt held for this event. */
  creditHeld: number;
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

/**
 * The statement of account for one event, from the facts alone. A reversed payment is listed and marked but never
 * counted, so what the lines add up to is what the totals say. Nothing internal is carried: no reasons, notes or payers.
 */
export function buildStatementOfAccount(input: StatementInputs): Omit<PrismStatementOfAccount, 'eventId' | 'eventName' | 'generatedAt'> {
  if (!visible(input) || !input.statement) {
    return { available: false, statementNumber: null, billed: 0, received: 0, refunded: 0, creditHeld: 0, balance: 0, milestones: [], lines: [] };
  }
  const credit = sum(input.milestones.map((milestone) => milestone.creditApplied));
  const lines = [...paymentLines(input.records), ...creditLine(input, credit), ...refundLines(input.refunds)]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return {
    available: true,
    statementNumber: input.statement.number,
    billed: input.statement.totalAmount,
    received: sum(lines.filter((line) => line.kind !== 'refund' && !line.reversed).map((line) => line.amount)),
    refunded: sum(lines.filter((line) => line.kind === 'refund').map((line) => line.amount)),
    creditHeld: input.creditHeld,
    balance: sum(input.milestones.map((milestone) => milestone.remainingBalance)),
    milestones: input.milestones.map((milestone) => ({
      id: milestone.id, label: milestone.label, dueDate: isoDate(milestone.dueDate), amount: milestone.amount, paid: milestone.amountPaid, remaining: milestone.remainingBalance, status: milestone.status,
    })),
    lines,
  };
}
