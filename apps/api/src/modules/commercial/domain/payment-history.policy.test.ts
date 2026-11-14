import { describe, expect, it } from 'vitest';
import { buildPaymentHistory, type PaymentHistoryFacts } from './payment-history.policy';

const at = (value: string) => new Date(value);

const receipt = (overrides: Partial<PaymentHistoryFacts['receipts'][number]>): PaymentHistoryFacts['receipts'][number] => ({
  id: 'r', amount: 66000, method: 'Bank Transfer', referenceNumber: 'BPI-1', source: 'client', recordedBy: 'Ana Reyes', createdAt: at('2026-11-10T02:00:00Z'),
  verifiedAt: null, verifiedBy: null, rejectedAt: null, rejectedBy: null, rejectionReason: null, ...overrides,
});

const record = (overrides: Partial<PaymentHistoryFacts['records'][number]>): PaymentHistoryFacts['records'][number] => ({
  id: 'p', amountReceived: 66000, paymentMethod: 'Bank Transfer', referenceNumber: 'BPI-2', recordedAt: at('2026-11-12T02:00:00Z'), recordedBy: 'Ms. Mys',
  receiptId: 'r2', reversesRecordId: null, reversalReason: null, ...overrides,
});

describe('payment history', () => {
  it('tells one payment\'s story in order, from scheduled through reminders, reports, checks and money applied, to paid in full', () => {
    const history = buildPaymentHistory({
      milestone: { id: 'm', label: 'Second payment', amount: 126000, amountPaid: 126000, remainingBalance: 0, dueDate: at('2026-10-19T00:00:00Z'), createdAt: at('2026-09-01T00:00:00Z') },
      reminders: [{ id: 'a1', at: at('2026-10-25T01:00:00Z'), by: 'Ms. Mys' }],
      receipts: [
        receipt({ id: 'r1', rejectedAt: at('2026-11-11T00:00:00Z'), rejectedBy: 'Ms. Mys', rejectionReason: 'No matching credit' }),
        receipt({ id: 'r2', referenceNumber: 'BPI-2', createdAt: at('2026-11-12T01:00:00Z'), verifiedAt: at('2026-11-13T00:00:00Z'), verifiedBy: 'Ms. Mys' }),
      ],
      records: [
        record({ id: 'p0', amountReceived: 60000, recordedAt: at('2026-09-20T00:00:00Z'), receiptId: 'r0', referenceNumber: 'GC-1', paymentMethod: 'GCash' }),
        record({ id: 'p1', recordedAt: at('2026-11-12T02:00:00Z') }),
        record({ id: 'p1-undo', recordedAt: at('2026-11-12T03:00:00Z'), reversesRecordId: 'p1', reversalReason: 'Applied to the wrong payment' }),
        record({ id: 'p2', recordedAt: at('2026-11-12T04:00:00Z') }),
      ],
      disputes: [{ id: 'd', amount: 6000, reason: 'Overtime was not agreed', raisedBy: 'Ana Reyes', createdAt: at('2026-10-20T00:00:00Z'), status: 'rejected', resolvedAt: at('2026-10-22T00:00:00Z'), resolvedBy: 'Ms. Mys', resolutionNotes: 'Signed overtime sheet attached' }],
    });

    expect(history.entries.map((entry) => [entry.kind, entry.title])).toEqual([
      ['scheduled', '₱126,000 scheduled'],
      ['applied', '₱60,000 applied'],
      ['disputed', 'Client questioned ₱6,000'],
      ['dispute_closed', 'Question answered, charge kept'],
      ['reminded', 'Client reminded'],
      ['reported', 'Client said they paid ₱66,000'],
      ['not_accepted', '₱66,000 not accepted'],
      ['reported', 'Client said they paid ₱66,000'],
      ['applied', '₱66,000 applied'],
      ['undone', '₱66,000 taken off this payment'],
      ['applied', '₱66,000 applied'],
      ['paid_in_full', 'Paid in full'],
      ['verified', '₱66,000 verified'],
    ]);
    expect(history.entries.find((entry) => entry.kind === 'not_accepted')).toMatchObject({ detail: 'No matching credit', receiptId: 'r1', by: 'Ms. Mys' });
    // Paid in full when the money that still counts was applied, not when the undone application was.
    expect(history.entries.find((entry) => entry.kind === 'paid_in_full')?.at).toBe('2026-11-12T04:00:00.000Z');
    expect(history.entries[0].detail).toBe('Due Oct 19, 2026.');
    expect(history).toMatchObject({ dueDate: '2026-10-19', remaining: 0 });
  });

  it('does not call a payment paid in full while money is still owed, or when its only money was undone', () => {
    const base = { label: 'Balance', amount: 100000, dueDate: at('2026-12-01T00:00:00Z'), createdAt: at('2026-09-01T00:00:00Z') };
    const owing = buildPaymentHistory({ milestone: { id: 'm', ...base, amountPaid: 40000, remainingBalance: 60000 }, records: [record({ id: 'p', amountReceived: 40000 })], receipts: [], disputes: [], reminders: [] });
    expect(owing.entries.map((entry) => entry.kind)).toEqual(['scheduled', 'applied']);

    const undone = buildPaymentHistory({
      milestone: { id: 'm', ...base, amount: 0, amountPaid: 0, remainingBalance: 0 },
      records: [record({ id: 'p' }), record({ id: 'u', reversesRecordId: 'p', recordedAt: at('2026-11-13T00:00:00Z') })], receipts: [], disputes: [], reminders: [],
    });
    expect(undone.entries.map((entry) => entry.kind)).not.toContain('paid_in_full');
  });
});
