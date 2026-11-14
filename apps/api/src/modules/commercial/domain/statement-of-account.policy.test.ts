import { describe, expect, it } from 'vitest';
import { buildStatementOfAccount, type StatementInputs, type StatementReceipt } from './statement-of-account.policy';

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);

function receipt(overrides: Partial<StatementReceipt>): StatementReceipt {
  return {
    id: 'rc', amount: 50000, receivedDate: d('2026-11-01'), method: 'GCash', referenceNumber: 'GC-9', status: 'recorded', source: 'pmcm',
    rejectionReason: null, intendedMilestoneId: null, hasProof: false, unapplied: 0, createdAt: d('2026-11-01'), ...overrides,
  };
}

function inputs(overrides: Partial<StatementInputs> = {}): StatementInputs {
  return {
    viewer: 'client',
    statement: { number: 'BS-1', totalAmount: 150000, sentAt: d('2026-10-01'), generatedAt: d('2026-09-30') },
    milestones: [
      { id: 'm1', label: 'Deposit', dueDate: d('2026-10-15'), amount: 100000, amountPaid: 100000, creditApplied: 0, remainingBalance: 0, status: 'paid' },
      { id: 'm2', label: 'Balance', dueDate: d('2026-12-01'), amount: 50000, amountPaid: 0, creditApplied: 0, remainingBalance: 50000, status: 'pending' },
    ],
    records: [{ id: 'r1', amountReceived: 100000, paymentDate: d('2026-10-10'), paymentMethod: 'Bank Transfer', referenceNumber: 'BDO-1', reversesRecordId: null }],
    refunds: [],
    ...overrides,
  };
}

describe('statement of account', () => {
  it('shows billed, received, what is owed and the payments behind it', () => {
    const result = buildStatementOfAccount(inputs());

    expect(result).toMatchObject({ available: true, statementNumber: 'BS-1', billed: 150000, received: 100000, refunded: 0, creditHeld: 0, balance: 50000 });
    expect(result.lines).toEqual([{ id: 'r1', date: '2026-10-10', kind: 'payment', description: 'Payment received', method: 'Bank Transfer', reference: 'BDO-1', amount: 100000, reversed: false }]);
    expect(result.milestones.map((milestone) => [milestone.label, milestone.remaining])).toEqual([['Deposit', 0], ['Balance', 50000]]);
  });

  it('shows a client nothing until PMCM has sent the statement, but shows PMCM the current one', () => {
    const unsent = { number: 'BS-1', totalAmount: 150000, sentAt: null, generatedAt: d('2026-09-30') };

    expect(buildStatementOfAccount(inputs({ statement: unsent }))).toEqual({
      available: false, statementNumber: null, billed: 0, received: 0, refunded: 0, creditHeld: 0, balance: 0, disputedOnStatement: 0, milestones: [], paymentMethods: [], submissions: [], lines: [],
    });
    expect(buildStatementOfAccount(inputs({ statement: null })).available).toBe(false);
    expect(buildStatementOfAccount(inputs({ statement: unsent, viewer: 'pmcm' }))).toMatchObject({ available: true, billed: 150000 });
  });

  it('lists a reversed payment, marked and without its reversal, and leaves it out of every total', () => {
    const result = buildStatementOfAccount(inputs({
      records: [
        { id: 'r1', amountReceived: 100000, paymentDate: d('2026-10-10'), paymentMethod: 'Cheque', referenceNumber: 'CHQ-9', reversesRecordId: null },
        { id: 'r2', amountReceived: -100000, paymentDate: d('2026-10-20'), paymentMethod: 'Cheque', referenceNumber: 'CHQ-9', reversesRecordId: 'r1' },
        { id: 'r3', amountReceived: 40000, paymentDate: d('2026-10-25'), paymentMethod: 'GCash', referenceNumber: 'GC-1', reversesRecordId: null },
      ],
    }));

    expect(result.lines.map((line) => [line.id, line.reversed])).toEqual([['r1', true], ['r3', false]]);
    expect(result.lines[0].description).toBe('Payment received, later reversed by PMCM');
    expect(result.received).toBe(40000);
  });

  it('adds credit carried from an earlier statement, and lists refunds and credit still held without counting them as received', () => {
    const result = buildStatementOfAccount(inputs({
      milestones: [{ id: 'm1', label: 'Deposit', dueDate: d('2026-10-15'), amount: 100000, amountPaid: 70000, creditApplied: 70000, remainingBalance: 30000, status: 'partially_paid' }],
      records: [],
      refunds: [{ id: 'rf1', amount: 5000, refundedDate: d('2026-10-30'), method: 'Bank Transfer', referenceNumber: 'RF-1' }],
      receipts: [receipt({ id: 'held', status: 'verified', unapplied: 12000 })],
    }));

    expect(result.received).toBe(70000);
    expect(result.refunded).toBe(5000);
    expect(result.creditHeld).toBe(12000);
    expect(result.lines.map((line) => [line.kind, line.amount])).toEqual([['credit', 70000], ['refund', 5000]]);
    expect(result.lines[0].date).toBe('2026-10-01');
  });

  it('puts the lines in date order, and what the lines add up to is what the totals say', () => {
    const result = buildStatementOfAccount(inputs({
      records: [
        { id: 'late', amountReceived: 20000, paymentDate: d('2026-11-05'), paymentMethod: 'GCash', referenceNumber: 'GC-2', reversesRecordId: null },
        { id: 'early', amountReceived: 80000, paymentDate: d('2026-10-05'), paymentMethod: 'Bank Transfer', referenceNumber: 'BDO-2', reversesRecordId: null },
      ],
    }));

    expect(result.lines.map((line) => line.id)).toEqual(['early', 'late']);
    expect(result.lines.reduce((total, line) => total + line.amount, 0)).toBe(result.received);
  });

  it('carries no reason, note or payer: only amounts, dates, methods and references', () => {
    const lineKeys = Object.keys(buildStatementOfAccount(inputs()).lines[0]).sort();

    expect(lineKeys).toEqual(['amount', 'date', 'description', 'id', 'kind', 'method', 'reference', 'reversed']);
  });

  it('counts unapplied money as credit only once PMCM has checked it; until then the client sees it being checked', () => {
    const result = buildStatementOfAccount(inputs({
      receipts: [
        receipt({ id: 'checked', status: 'verified', unapplied: 12000 }),
        receipt({ id: 'unchecked', status: 'recorded', unapplied: 8000, intendedMilestoneId: 'm2' }),
      ],
    }));

    expect(result.creditHeld).toBe(12000);
    expect(result.submissions).toEqual([expect.objectContaining({ id: 'payment-1', state: 'checking', unapplied: 8000, forPayment: 'Balance' })]);
  });

  it('marks the part of a payment that came from unchecked money, any open dispute on it, and the day it was settled', () => {
    const result = buildStatementOfAccount(inputs({
      milestones: [
        { id: 'm1', label: 'Deposit', dueDate: d('2026-10-15'), amount: 100000, amountPaid: 100000, creditApplied: 0, remainingBalance: 0, status: 'paid' },
        { id: 'm2', label: 'Balance', dueDate: d('2026-12-01'), amount: 50000, amountPaid: 20000, creditApplied: 0, remainingBalance: 30000, status: 'partially_paid' },
      ],
      records: [
        { id: 'r1', milestoneId: 'm1', receiptId: 'ok', amountReceived: 60000, paymentDate: d('2026-10-01'), paymentMethod: 'Bank Transfer', referenceNumber: 'B-1', reversesRecordId: null },
        { id: 'r2', milestoneId: 'm1', receiptId: 'ok2', amountReceived: 40000, paymentDate: d('2026-10-12'), paymentMethod: 'Bank Transfer', referenceNumber: 'B-2', reversesRecordId: null },
        { id: 'r3', milestoneId: 'm2', receiptId: 'pending', amountReceived: 20000, paymentDate: d('2026-11-02'), paymentMethod: 'GCash', referenceNumber: 'G-1', reversesRecordId: null },
      ],
      receipts: [receipt({ id: 'ok', status: 'verified' }), receipt({ id: 'ok2', status: 'verified' }), receipt({ id: 'pending', status: 'recorded', amount: 20000 })],
      openDisputes: [{ milestoneId: 'm2', amount: 15000 }, { milestoneId: null, amount: 4000 }],
    }));

    expect(result.milestones.map(({ label, checking, disputed, settledOn }) => ({ label, checking, disputed, settledOn }))).toEqual([
      { label: 'Deposit', checking: 0, disputed: 0, settledOn: '2026-10-12' },
      { label: 'Balance', checking: 20000, disputed: 15000, settledOn: null },
    ]);
    expect(result.disputedOnStatement).toBe(4000);
  });

  it('tells the client which payments did not count and why, and which payments they reported were accepted', () => {
    const result = buildStatementOfAccount(inputs({
      receipts: [
        receipt({ id: 'bounced', status: 'rejected', rejectionReason: 'No matching credit on our bank statement.', receivedDate: d('2026-11-03') }),
        receipt({ id: 'theirs', status: 'verified', source: 'client', hasProof: true, receivedDate: d('2026-11-02') }),
        receipt({ id: 'ours', status: 'verified', source: 'pmcm', receivedDate: d('2026-11-01') }),
      ],
    }));

    // Only a payment the client reported carries its id, so they can add proof to it; PMCM's own receipts stay opaque.
    expect(result.submissions.map(({ id, state, reason, fromClient, hasProof }) => ({ id, state, reason, fromClient, hasProof }))).toEqual([
      { id: 'payment-1', state: 'not_accepted', reason: 'No matching credit on our bank statement.', fromClient: false, hasProof: false },
      { id: 'theirs', state: 'accepted', reason: null, fromClient: true, hasProof: true },
    ]);
  });

  it('carries how to pay from the statement, dropping entries with no name', () => {
    const result = buildStatementOfAccount(inputs({
      statement: { number: 'BS-1', totalAmount: 150000, sentAt: d('2026-10-01'), generatedAt: d('2026-09-30'), paymentMethods: [{ label: ' BPI ', details: 'Acct 123' }, { label: '', details: 'x' }, 'junk'] },
    }));

    expect(result.paymentMethods).toEqual([{ label: 'BPI', details: 'Acct 123' }]);
  });
});
