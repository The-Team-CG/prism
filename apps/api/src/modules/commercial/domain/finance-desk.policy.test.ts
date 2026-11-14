import { describe, expect, it } from 'vitest';
import type { PrismStatementMilestone, PrismStatementOfAccount } from '@prism/types';
import { buildFinanceDesk, type FinanceDeskFacts } from './finance-desk.policy';

const TODAY = '2026-11-14';

function milestone(overrides: Partial<PrismStatementMilestone>): PrismStatementMilestone {
  return { id: 'm', label: 'Balance', dueDate: '2026-12-30', amount: 100000, paid: 0, remaining: 100000, status: 'pending', checking: 0, disputed: 0, settledOn: null, ...overrides };
}

function statement(eventId: string, milestones: PrismStatementMilestone[]): PrismStatementOfAccount {
  return {
    eventId, eventName: `Event ${eventId}`, generatedAt: '', available: true, statementNumber: `BS-${eventId}`, billed: milestones.reduce((sum, item) => sum + item.amount, 0),
    received: 0, refunded: 0, creditHeld: 0, balance: milestones.reduce((sum, item) => sum + item.remaining, 0), disputedOnStatement: 0, milestones, paymentMethods: [], submissions: [], lines: [],
  };
}

function facts(overrides: Partial<FinanceDeskFacts> = {}): FinanceDeskFacts {
  return {
    today: TODAY,
    events: [{ id: 'a', eventName: 'Event a', eventDate: '2026-10-22', clientName: 'Ana Reyes' }, { id: 'b', eventName: 'Event b', eventDate: '2026-11-23', clientName: 'Ana Reyes' }],
    statements: [],
    receipts: [],
    disputes: [],
    corrections: [],
    draftSources: [],
    unsentStatements: [],
    payouts: [],
    ...overrides,
  };
}

describe('finance desk', () => {
  it('leads with money that is late, client and supplier, then what to check or answer, then setup', () => {
    const desk = buildFinanceDesk(facts({
      statements: [{ sent: true, statement: statement('a', [milestone({ id: 'late', dueDate: '2026-10-15', remaining: 125000, amount: 125000, disputed: 30000 })]) }],
      receipts: [{ id: 'r1', eventId: 'a', amount: 60000, receivedDate: '2026-11-10', method: 'GCash', referenceNumber: 'GC-1', status: 'recorded', source: 'client', unapplied: 60000, forPayment: 'Balance', hasProof: true }],
      disputes: [{ id: 'd1', eventId: 'a', amount: 30000, reason: 'No overtime was agreed.', payment: 'Balance', raisedOn: '2026-11-14' }],
      draftSources: [{ id: 's1', eventId: 'b', label: 'Late charges', amount: 12000 }],
      payouts: [{ id: 'p1', eventId: 'b', eventName: 'Event b', supplierName: 'Bloom Florals', label: 'Deposit', amount: 90000, released: 0, dueDate: '2026-11-09', status: 'scheduled' }],
    }), 'now');

    expect(desk.queue.map((item) => [item.kind, item.severity, item.title])).toEqual([
      ['client_overdue', 'critical', '₱95,000 overdue from Ana Reyes'],
      ['supplier_overdue', 'critical', 'Pay Bloom Florals ₱90,000'],
      ['verify_payment', 'warning', 'Check ₱60,000 GCash payment'],
      ['dispute', 'warning', 'Answer a ₱30,000 dispute'],
      ['approve_source', 'info', 'Approve a billing source'],
    ]);
    expect(desk.queue[2]).toMatchObject({ detail: 'Reported by the client · Ref GC-1 · for Balance · proof attached', href: '/dashboard/finance/receipts?receipt=r1' });
    expect(desk.queue[1].detail).toBe('Deposit · due Nov 9 · 5 days late');
  });

  it('adds up what is late, due soon, to check and unapplied, leaving out amounts under dispute', () => {
    const desk = buildFinanceDesk(facts({
      statements: [
        { sent: true, statement: statement('a', [milestone({ id: 'late', dueDate: '2026-10-15', disputed: 30000 }), milestone({ id: 'soon', dueDate: '2026-11-20', amount: 84000, remaining: 84000 })]) },
        { sent: true, statement: statement('b', [milestone({ id: 'later', dueDate: '2027-01-30' })]) },
      ],
      receipts: [
        { id: 'r1', eventId: 'a', amount: 60000, receivedDate: '2026-11-10', method: 'GCash', referenceNumber: '', status: 'recorded', source: 'pmcm', unapplied: 0, forPayment: null, hasProof: false },
        { id: 'r2', eventId: 'b', amount: 100000, receivedDate: '2026-11-13', method: 'Bank Transfer', referenceNumber: 'B-1', status: 'verified', source: 'pmcm', unapplied: 100000, forPayment: null, hasProof: false },
      ],
      payouts: [{ id: 'p1', eventId: 'b', eventName: 'Event b', supplierName: 'XPERTO', label: 'Second payment', amount: 145500, released: 50000, dueDate: '2026-11-16', status: 'partially_released' }],
    }), 'now');

    expect(desk.totals).toMatchObject({ clientOverdue: 70000, clientDueSoon: 84000, toVerify: 60000, toVerifyCount: 1, unapplied: 100000, supplierOverdue: 0, supplierDueSoon: 95500 });
    expect(desk.queue.find((item) => item.kind === 'apply_money')).toMatchObject({ title: 'Apply ₱100,000 received', eventName: 'Event b' });
    // The event with money overdue comes first.
    expect(desk.events.map((event) => [event.eventId, event.overdue])).toEqual([['a', 70000], ['b', 0]]);
  });

  it('asks to send a statement the client cannot see yet, and leaves fully paid payouts and far-off payouts out of the queue', () => {
    const desk = buildFinanceDesk(facts({
      unsentStatements: [{ id: 'st', eventId: 'b', number: 'BS-9', amount: 50000 }],
      payouts: [
        { id: 'paid', eventId: 'b', eventName: 'Event b', supplierName: 'X', label: 'Deposit', amount: 1000, released: 1000, dueDate: '2026-11-01', status: 'released' },
        { id: 'far', eventId: 'b', eventName: 'Event b', supplierName: 'X', label: 'Balance', amount: 1000, released: 0, dueDate: '2026-12-30', status: 'scheduled' },
      ],
    }), 'now');

    expect(desk.queue.map((item) => item.id)).toEqual(['send:st']);
  });
});
