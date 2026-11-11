import { describe, expect, it } from 'vitest';
import { computeEventFinancials, type FinancialInputs } from './event-financials.policy';

const now = new Date('2026-11-11T00:00:00.000Z');

function inputs(overrides: Partial<FinancialInputs> = {}): FinancialInputs {
  return {
    statement: { number: 'BS-1', totalAmount: 150000 },
    estimate: { status: 'approved', totalAmount: 140000, lines: [{ category: 'Catering', totalAmount: 90000 }, { category: 'Sound', totalAmount: 50000 }] },
    milestones: [
      { amount: 100000, creditApplied: 0, remainingBalance: 0, dueDate: new Date('2026-10-01T00:00:00.000Z') },
      { amount: 50000, creditApplied: 0, remainingBalance: 50000, dueDate: new Date('2026-12-01T00:00:00.000Z') },
    ],
    appliedByReceipt: [{ receiptId: 'prcp_1', amount: 100000 }],
    receiptStatus: new Map([['prcp_1', 'verified']]),
    unapplied: 0,
    quotes: [{ id: 'q1', category: 'Catering', amount: 60000 }, { id: 'q2', category: 'Sound', amount: 30000 }],
    payables: [{ amount: 60000 }, { amount: 30000 }],
    payouts: [{ quoteId: 'q1', kind: 'release', amount: 20000 }],
    now,
    ...overrides,
  };
}

describe('event financials', () => {
  it('reports collections, cost and margin from the facts, with nothing to flag when they agree', () => {
    const result = computeEventFinancials(inputs());

    expect(result.price).toEqual({ estimated: 140000, estimateStatus: 'approved', billed: 150000, statementNumber: 'BS-1' });
    expect(result.collections).toEqual({ scheduled: 150000, received: 100000, credit: 0, outstanding: 50000, overdue: 0, verifiedReceived: 100000, unverifiedReceived: 0, unapplied: 0 });
    expect(result.costs).toEqual({ committed: 90000, scheduled: 90000, actual: 20000, toPay: 70000 });
    expect(result.margin).toEqual({ expected: 60000, basis: 'statement', cashToDate: 80000 });
    expect(result.notes).toEqual([]);
  });

  it('breaks the estimate, the committed quotes and what was paid down by category, largest committed cost first', () => {
    expect(computeEventFinancials(inputs()).categories).toEqual([
      { category: 'Catering', estimatedPrice: 90000, committedCost: 60000, actualCost: 20000, expectedMargin: 30000 },
      { category: 'Sound', estimatedPrice: 50000, committedCost: 30000, actualCost: 0, expectedMargin: 20000 },
    ]);
  });

  it('nets a payout reversal out of what was paid, and counts a payout for an unknown quote as Other', () => {
    const result = computeEventFinancials(inputs({ payouts: [
      { quoteId: 'q1', kind: 'release', amount: 30000 },
      { quoteId: 'q1', kind: 'reversal', amount: 10000 },
      { quoteId: 'gone', kind: 'release', amount: 5000 },
    ] }));

    expect(result.costs.actual).toBe(25000);
    expect(result.categories.find((line) => line.category === 'Catering')?.actualCost).toBe(20000);
    expect(result.categories.find((line) => line.category === 'Other')).toEqual({ category: 'Other', estimatedPrice: 0, committedCost: 0, actualCost: 5000, expectedMargin: 0 });
  });

  it('splits what was received into verified and not yet verified, treating a record with no receipt as unverified', () => {
    const result = computeEventFinancials(inputs({
      appliedByReceipt: [{ receiptId: 'prcp_1', amount: 60000 }, { receiptId: 'prcp_2', amount: 30000 }, { receiptId: null, amount: 10000 }],
      receiptStatus: new Map([['prcp_1', 'verified'], ['prcp_2', 'recorded']]),
    }));

    expect(result.collections).toMatchObject({ received: 100000, verifiedReceived: 60000, unverifiedReceived: 40000 });
    expect(result.notes).toContain('PHP 40,000 of the money received comes from receipts not yet verified against a bank or wallet statement.');
  });

  it('counts only outstanding balances already past due as overdue', () => {
    const result = computeEventFinancials(inputs({ milestones: [
      { amount: 100000, creditApplied: 0, remainingBalance: 40000, dueDate: new Date('2026-11-10T23:59:59.000Z') },
      { amount: 50000, creditApplied: 20000, remainingBalance: 30000, dueDate: new Date('2026-11-11T00:00:00.000Z') },
    ] }));

    expect(result.collections).toMatchObject({ outstanding: 70000, overdue: 40000, credit: 20000 });
  });

  it('measures the margin against the proposal estimate until a statement exists, and says so', () => {
    const result = computeEventFinancials(inputs({ statement: null }));

    expect(result.margin).toEqual({ expected: 50000, basis: 'estimate', cashToDate: 80000 });
    expect(result.price.billed).toBeNull();
    expect(result.notes).toContain('No billing statement has been issued yet, so the expected margin uses the proposal estimate.');
  });

  it('has no margin at all, and says why, when there is neither a statement nor an estimate', () => {
    const result = computeEventFinancials(inputs({ statement: null, estimate: null }));

    expect(result.margin.expected).toBeNull();
    expect(result.margin.basis).toBeNull();
    expect(result.price.estimateStatus).toBeNull();
    expect(result.notes).toContain('There is no billing statement or proposal estimate yet, so there is no price to measure against.');
  });

  it('flags every place the figures disagree with each other', () => {
    const result = computeEventFinancials(inputs({
      milestones: [{ amount: 120000, creditApplied: 0, remainingBalance: 20000, dueDate: new Date('2026-12-01T00:00:00.000Z') }],
      unapplied: 15000,
      payables: [{ amount: 50000 }],
      payouts: [{ quoteId: 'q1', kind: 'release', amount: 95000 }],
      quotes: [{ id: 'q1', category: 'Catering', amount: 160000 }],
    }));

    expect(result.notes).toEqual([
      'Payment milestones total PHP 120,000 but the billing statement is PHP 150,000. Check they were regenerated together.',
      'PHP 15,000 was received for this event but is not applied to a milestone.',
      'PHP 110,000 of committed supplier cost has no payment schedule yet.',
      'Committed supplier cost is PHP 10,000 above the price.',
    ]);
  });

  it('flags paying suppliers more than their quotes commit, and never reports a negative amount still to pay', () => {
    const result = computeEventFinancials(inputs({ payouts: [{ quoteId: 'q1', kind: 'release', amount: 100000 }] }));

    expect(result.costs).toMatchObject({ actual: 100000, toPay: 0 });
    expect(result.notes).toContain('PHP 10,000 more has been paid to suppliers than their selected quotes commit.');
  });

  it('is all zeros and nulls for an event with nothing recorded, never NaN', () => {
    const empty = computeEventFinancials({
      statement: null, estimate: null, milestones: [], appliedByReceipt: [], receiptStatus: new Map(), unapplied: 0, quotes: [], payables: [], payouts: [], now,
    });

    expect(empty.collections).toEqual({ scheduled: 0, received: 0, credit: 0, outstanding: 0, overdue: 0, verifiedReceived: 0, unverifiedReceived: 0, unapplied: 0 });
    expect(empty.costs).toEqual({ committed: 0, scheduled: 0, actual: 0, toPay: 0 });
    expect(empty.margin).toEqual({ expected: null, basis: null, cashToDate: 0 });
    expect(empty.categories).toEqual([]);
  });
});
