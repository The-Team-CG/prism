import type { PrismPaymentHistory, PrismPaymentHistoryEntry } from '@prism/types';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const day = (value: Date) => value.toISOString().slice(0, 10);
const readableDay = (value: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(value);

export interface PaymentHistoryFacts {
  milestone: { id: string; label: string; amount: number; amountPaid: number; remainingBalance: number; dueDate: Date; createdAt: Date };
  /** Money applied to this payment, and any reversal of it. */
  records: Array<{
    id: string; amountReceived: number; paymentMethod: string; referenceNumber: string; recordedAt: Date; recordedBy: string | null;
    receiptId: string | null; reversesRecordId: string | null; reversalReason: string | null;
  }>;
  /** Receipts the client reported for this payment, or whose money was applied to it. */
  receipts: Array<{
    id: string; amount: number; method: string; referenceNumber: string; source: string; recordedBy: string; createdAt: Date;
    verifiedAt: Date | null; verifiedBy: string | null; rejectedAt: Date | null; rejectedBy: string | null; rejectionReason: string | null;
  }>;
  disputes: Array<{ id: string; amount: number; reason: string; raisedBy: string; createdAt: Date; status: string; resolvedAt: Date | null; resolvedBy: string | null; resolutionNotes: string | null }>;
  reminders: Array<{ id: string; at: Date; by: string }>;
}

type Entry = Omit<PrismPaymentHistoryEntry, 'at'> & { at: Date };
type ReceiptFact = PaymentHistoryFacts['receipts'][number];
type RecordFact = PaymentHistoryFacts['records'][number];
type DisputeFact = PaymentHistoryFacts['disputes'][number];

const withRef = (base: string, reference: string) => (reference ? `${base} · Ref ${reference}` : base);

function receiptEntries(receipt: ReceiptFact): Entry[] {
  const fromClient = receipt.source === 'client';
  const base = { amount: receipt.amount, receiptId: receipt.id };
  const entries: Entry[] = [{
    ...base, id: `receipt:${receipt.id}`, kind: fromClient ? 'reported' : 'recorded', at: receipt.createdAt, by: receipt.recordedBy,
    title: fromClient ? `Client said they paid ${peso.format(receipt.amount)}` : `PMCM recorded ${peso.format(receipt.amount)} received`,
    detail: withRef(receipt.method, receipt.referenceNumber),
  }];
  if (receipt.verifiedAt) {
    entries.push({ ...base, id: `verified:${receipt.id}`, kind: 'verified', at: receipt.verifiedAt, by: receipt.verifiedBy, title: `${peso.format(receipt.amount)} verified`, detail: 'Matched against the bank or wallet statement.' });
  }
  if (receipt.rejectedAt) {
    entries.push({ ...base, id: `rejected:${receipt.id}`, kind: 'not_accepted', at: receipt.rejectedAt, by: receipt.rejectedBy, title: `${peso.format(receipt.amount)} not accepted`, detail: receipt.rejectionReason ?? '' });
  }
  return entries;
}

function recordEntry(record: RecordFact): Entry {
  const base = { id: `record:${record.id}`, at: record.recordedAt, amount: record.amountReceived, receiptId: record.receiptId ?? undefined, by: record.recordedBy };
  if (record.reversesRecordId) {
    return { ...base, kind: 'undone', title: `${peso.format(record.amountReceived)} taken off this payment`, detail: record.reversalReason ?? '' };
  }
  return { ...base, kind: 'applied', title: `${peso.format(record.amountReceived)} applied`, detail: withRef(record.paymentMethod, record.referenceNumber) };
}

function disputeEntries(dispute: DisputeFact): Entry[] {
  const entries: Entry[] = [{ id: `dispute:${dispute.id}`, kind: 'disputed', at: dispute.createdAt, amount: dispute.amount, by: dispute.raisedBy, title: `Client questioned ${peso.format(dispute.amount)}`, detail: dispute.reason }];
  if (dispute.resolvedAt) {
    const kept = dispute.status === 'rejected';
    entries.push({ id: `dispute-closed:${dispute.id}`, kind: 'dispute_closed', at: dispute.resolvedAt, amount: dispute.amount, by: dispute.resolvedBy, title: kept ? 'Question answered, charge kept' : 'Question resolved', detail: dispute.resolutionNotes ?? '' });
  }
  return entries;
}

/** When the money that settled the payment was applied, counting only money still applied. */
function paidInFull(facts: PaymentHistoryFacts): Entry[] {
  if (facts.milestone.remainingBalance > 0) return [];
  const undone = new Set(facts.records.flatMap((record) => (record.reversesRecordId ? [record.reversesRecordId] : [])));
  const kept = facts.records.filter((record) => !record.reversesRecordId && !undone.has(record.id));
  const last = kept.map((record) => record.recordedAt).sort((a, b) => a.getTime() - b.getTime()).pop();
  if (!last) return [];
  return [{ id: `paid:${facts.milestone.id}`, kind: 'paid_in_full', at: last, amount: facts.milestone.amount, by: null, title: 'Paid in full', detail: `${peso.format(facts.milestone.amount)} received toward ${facts.milestone.label}.` }];
}

/** Everything that happened to one payment, oldest first, as PMCM reads it in the payment's history. */
export function buildPaymentHistory(facts: PaymentHistoryFacts): PrismPaymentHistory {
  const { milestone } = facts;
  const entries: Entry[] = [
    { id: `scheduled:${milestone.id}`, kind: 'scheduled', at: milestone.createdAt, amount: milestone.amount, by: null, title: `${peso.format(milestone.amount)} scheduled`, detail: `Due ${readableDay(milestone.dueDate)}.` },
    ...facts.reminders.map((reminder): Entry => ({ id: `reminder:${reminder.id}`, kind: 'reminded', at: reminder.at, amount: null, by: reminder.by, title: 'Client reminded', detail: 'A reminder notice went to the client.' })),
    ...facts.receipts.flatMap(receiptEntries),
    ...facts.records.map(recordEntry),
    ...facts.disputes.flatMap(disputeEntries),
    ...paidInFull(facts),
  ];
  entries.sort((a, b) => a.at.getTime() - b.at.getTime());
  return {
    milestoneId: milestone.id,
    label: milestone.label,
    amount: milestone.amount,
    paid: milestone.amountPaid,
    remaining: milestone.remainingBalance,
    dueDate: day(milestone.dueDate),
    entries: entries.map((entry) => ({ ...entry, at: entry.at.toISOString() })),
  };
}
