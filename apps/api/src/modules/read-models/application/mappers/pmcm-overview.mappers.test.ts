import { describe, expect, it } from 'vitest';
import {
  buildEventSummaries,
  buildPmcmCalendarItems,
  manilaClockOf,
  manilaDateKeyOf,
  summarizeEventBalances,
  unreadMessagesByEvent,
} from './pmcm-overview.mappers';

const milestone = (overrides: Partial<Parameters<typeof summarizeEventBalances>[0][number]> = {}) => ({
  id: 'm1', eventId: 'e1', label: 'Downpayment', amount: 100_000, amountPaid: 0, creditApplied: 0, dueDate: new Date('2026-11-10T00:00:00.000Z'), ...overrides,
});

describe('Manila wall clock', () => {
  it('reads an instant as the Philippine date and time', () => {
    const instant = new Date('2026-11-05T22:00:00.000Z');
    expect(manilaDateKeyOf(instant)).toBe('2026-11-06');
    expect(manilaClockOf(instant)).toBe('06:00');
    expect(manilaDateKeyOf(new Date('2026-11-12T15:59:59.999Z'))).toBe('2026-11-12');
  });
});

describe('event balances and unread messages', () => {
  it('sums what each event still owes, finds its earliest due date and counts milestones past due', () => {
    const balances = summarizeEventBalances([
      milestone({ id: 'a', dueDate: new Date('2026-11-20T00:00:00.000Z'), amount: 50_000, amountPaid: 20_000 }),
      milestone({ id: 'b', dueDate: new Date('2026-11-01T00:00:00.000Z'), amount: 30_000, creditApplied: 5_000 }),
      milestone({ id: 'paid', amount: 40_000, amountPaid: 40_000 }),
      milestone({ id: 'other', eventId: 'e2', amount: 10_000 }),
    ], '2026-11-05');

    expect(balances.get('e1')).toEqual({ balanceDue: 55_000, nextPaymentDue: '2026-11-01', overdueMilestones: 1 });
    expect(balances.get('e2')).toEqual({ balanceDue: 10_000, nextPaymentDue: '2026-11-10', overdueMilestones: 0 });
    expect(balances.has('paid')).toBe(false);
  });

  it('counts messages newer than the last read, and every message in a thread never read', () => {
    const unread = unreadMessagesByEvent(
      [
        { threadId: 't1', eventId: 'e1', lastReadAt: new Date('2026-11-04T10:00:00.000Z') },
        { threadId: 't2', eventId: 'e1', lastReadAt: null },
        { threadId: 't3', eventId: 'e2', lastReadAt: new Date('2026-11-04T10:00:00.000Z') },
      ],
      [
        { threadId: 't1', createdAt: new Date('2026-11-04T09:00:00.000Z') },
        { threadId: 't1', createdAt: new Date('2026-11-04T11:00:00.000Z') },
        { threadId: 't2', createdAt: new Date('2026-11-01T11:00:00.000Z') },
        { threadId: 't3', createdAt: new Date('2026-11-04T10:00:00.000Z') },
        { threadId: 'unknown', createdAt: new Date('2026-11-04T12:00:00.000Z') },
      ],
    );

    expect(unread.get('e1')).toBe(2);
    expect(unread.has('e2')).toBe(false);
  });

  it('lists every event that owes money or has unread messages, with zeros where there is none', () => {
    const items = buildEventSummaries(summarizeEventBalances([milestone()], '2026-11-05'), new Map([['e9', 3]]));
    expect(items).toEqual([
      { eventId: 'e1', balanceDue: 100_000, nextPaymentDue: '2026-11-10', overdueMilestones: 0, unreadMessages: 0 },
      { eventId: 'e9', balanceDue: 0, nextPaymentDue: null, overdueMilestones: 0, unreadMessages: 3 },
    ]);
  });
});

describe('buildPmcmCalendarItems', () => {
  it('places every dated fact on its Philippine date, keeps times for timed items, and stays inside the window', () => {
    const items = buildPmcmCalendarItems({
      from: '2026-11-01',
      to: '2026-11-30',
      events: [{ id: 'e1', eventName: 'Gala', eventDate: new Date('2026-11-20T00:00:00.000Z') }, { id: 'far', eventName: 'Later', eventDate: new Date('2027-03-01T00:00:00.000Z') }],
      eventNames: new Map([['e1', 'Gala']]),
      quoteRequests: [{ id: 'q1', eventId: 'e1', supplierName: 'XPERTO', category: 'Registration', dueDate: new Date('2026-11-12T15:59:59.999Z') }],
      milestones: [milestone({ id: 'm1' }), milestone({ id: 'settled', amountPaid: 100_000 })],
      ocularVisits: [{ id: 'o1', eventId: 'e1', scheduledAt: new Date('2026-11-05T02:30:00.000Z') }],
      schedules: [{ id: 's1', eventId: 'e1', ingressAt: new Date('2026-11-19T22:00:00.000Z'), egressAt: new Date('2026-11-20T10:00:00.000Z'), location: 'Hall A', supplierName: 'XPERTO' }],
      scheduleDays: [],
    });

    expect(items.map((item) => [item.date, item.startTime ?? null, item.kind])).toEqual([
      ['2026-11-05', '10:30', 'ocular_visit'],
      ['2026-11-10', null, 'payment_due'],
      ['2026-11-12', null, 'quote_deadline'],
      // 22:00 UTC is 06:00 the next day in Manila.
      ['2026-11-20', null, 'event'],
      ['2026-11-20', '06:00', 'supplier_arrival'],
      ['2026-11-20', '18:00', 'supplier_departure'],
    ]);
    expect(items.find((item) => item.kind === 'payment_due')?.detail).toContain('100,000');
    expect(items.some((item) => item.id === 'payment:settled')).toBe(false);
  });

  it('leads event days and other schedule days to their run sheet without doubling the event day', () => {
    const items = buildPmcmCalendarItems({
      from: '2026-11-01',
      to: '2026-11-30',
      events: [{ id: 'e1', eventName: 'Gala', eventDate: new Date('2026-11-20T00:00:00.000Z') }, { id: 'e2', eventName: 'Fair', eventDate: new Date('2026-11-25T00:00:00.000Z') }],
      eventNames: new Map([['e1', 'Gala'], ['e2', 'Fair'], ['e3', 'Expo']]),
      quoteRequests: [],
      milestones: [],
      ocularVisits: [],
      schedules: [],
      scheduleDays: [
        { id: 'd1', eventId: 'e1', dayDate: new Date('2026-11-20T00:00:00.000Z'), label: 'Main day' },
        { id: 'd0', eventId: 'e1', dayDate: new Date('2026-11-19T00:00:00.000Z'), label: 'Load-in' },
        // An event whose own date is outside the window still shows its schedule days inside it.
        { id: 'd3', eventId: 'e3', dayDate: new Date('2026-11-28T00:00:00.000Z'), label: '' },
      ],
    });

    expect(items.map((item) => [item.date, item.kind, item.eventName, item.scheduleDayId ?? null, item.detail])).toEqual([
      ['2026-11-19', 'schedule_day', 'Gala', 'd0', 'Load-in'],
      ['2026-11-20', 'event', 'Gala', 'd1', 'Event day'],
      ['2026-11-25', 'event', 'Fair', null, 'Event day'],
      ['2026-11-28', 'schedule_day', 'Expo', 'd3', 'Event-day schedule'],
    ]);
  });
});
