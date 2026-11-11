import { describe, expect, it } from 'vitest';
import { buildStatementOfAccount, type StatementInputs } from './statement-of-account.policy';

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);

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
    creditHeld: 0,
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
      available: false, statementNumber: null, billed: 0, received: 0, refunded: 0, creditHeld: 0, balance: 0, milestones: [], lines: [],
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
      creditHeld: 12000,
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
});
