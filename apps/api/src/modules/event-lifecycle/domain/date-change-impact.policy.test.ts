import { describe, expect, it } from 'vitest';
import { approvedWorkFrom, paymentImpacts, paymentState, shiftBetween, supplierConflicts, type MilestoneFacts } from './date-change-impact.policy';

const milestone = (overrides: Partial<MilestoneFacts> = {}): MilestoneFacts => ({
  id: 'ms_1', label: 'Deposit', amount: 50000, amountPaid: 0, remainingBalance: 50000, dueDate: '2026-11-20', ...overrides,
});

describe('date change impact', () => {
  it('counts whole days between two calendar dates, negative when the event moves earlier', () => {
    expect(shiftBetween('2026-12-20', '2027-01-03')).toBe(14);
    expect(shiftBetween('2026-12-20', '2026-12-20')).toBe(0);
    expect(shiftBetween('2026-12-20', '2026-12-13')).toBe(-7);
    expect(shiftBetween('2028-02-28', '2028-03-01')).toBe(2);
  });

  it('calls a milestone paid, partly paid or open from what is owed and what has arrived', () => {
    expect(paymentState({ amountPaid: 50000, remainingBalance: 0 })).toBe('paid');
    expect(paymentState({ amountPaid: 20000, remainingBalance: 30000 })).toBe('partial');
    expect(paymentState({ amountPaid: 0, remainingBalance: 50000 })).toBe('open');
  });

  it('offers a moved due date only for a balance still owed, and never changes what was paid', () => {
    const impacts = paymentImpacts([
      milestone({ id: 'paid', amountPaid: 50000, remainingBalance: 0, dueDate: '2026-10-01' }),
      milestone({ id: 'partial', amountPaid: 20000, remainingBalance: 30000, dueDate: '2026-11-20' }),
      milestone({ id: 'open', dueDate: '2026-12-13' }),
    ], 14);

    expect(impacts.map((entry) => [entry.milestoneId, entry.state, entry.suggestedDueDate])).toEqual([
      ['paid', 'paid', null],
      ['partial', 'partial', '2026-12-04'],
      ['open', 'open', '2026-12-27'],
    ]);
    expect(impacts[1]).toMatchObject({ amount: 50000, amountPaid: 20000, remaining: 30000 });
  });

  it('offers no new date when the date is not being considered or does not move, and never reports a negative balance', () => {
    expect(paymentImpacts([milestone()], null)[0]!.suggestedDueDate).toBeNull();
    expect(paymentImpacts([milestone()], 0)[0]!.suggestedDueDate).toBeNull();
    expect(paymentImpacts([milestone({ amountPaid: 60000, remainingBalance: -10000 })], 7)[0]).toMatchObject({ state: 'paid', remaining: 0, suggestedDueDate: null });
    expect(paymentImpacts([milestone()], -10)[0]!.suggestedDueDate).toBe('2026-11-10');
  });

  it('says why a supplier may not serve the new date, in the order it matters', () => {
    expect(supplierConflicts({ blockedOnNewDate: false, otherEventsOnNewDate: [] })).toEqual([]);
    expect(supplierConflicts({ blockedOnNewDate: true, otherEventsOnNewDate: ['Gala Night', 'Trade Fair'] })).toEqual([
      'Marked unavailable on that date',
      'Already booked for Gala Night on that date',
      'Already booked for Trade Fair on that date',
    ]);
  });

  it('lists only what the client actually signed or approved, and never anything else', () => {
    const none = { conformeSigned: false, proposalApproved: false, floorPlanApproved: false, billingSent: false };
    expect(approvedWorkFrom(none)).toEqual([]);
    expect(approvedWorkFrom({ ...none, conformeSigned: true, billingSent: true }).map((entry) => entry.kind)).toEqual(['conforme', 'billing']);
    const all = approvedWorkFrom({ conformeSigned: true, proposalApproved: true, floorPlanApproved: true, billingSent: true });
    expect(all.map((entry) => entry.kind)).toEqual(['conforme', 'proposal', 'floorplan', 'billing']);
    expect(all[0]).toEqual({ kind: 'conforme', label: 'Signed conforme', detail: expect.stringContaining('addendum') });
    expect(Object.keys(all[0]!)).toEqual(['kind', 'label', 'detail']);
  });
});
