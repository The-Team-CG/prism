import type { PrismPmcmCalendarItem, PrismPmcmEventSummary } from '@prism/types';

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** The Philippines has no daylight saving, so a fixed +08:00 offset is the Manila wall clock. */
export const manilaDateKeyOf = (value: Date) => new Date(value.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
export const manilaClockOf = (value: Date) => new Date(value.getTime() + MANILA_OFFSET_MS).toISOString().slice(11, 16);
/** Date-only columns (event and milestone dates) are stored as UTC midnight of the calendar date. */
export const calendarDateKeyOf = (value: Date) => value.toISOString().slice(0, 10);

export type MilestoneFact = {
  id: string;
  eventId: string;
  label: string;
  amount: number;
  amountPaid: number;
  creditApplied: number;
  dueDate: Date;
};

export type BalanceSummary = Pick<PrismPmcmEventSummary, 'balanceDue' | 'nextPaymentDue' | 'overdueMilestones'>;

const owed = (milestone: MilestoneFact) => Math.max(0, milestone.amount - milestone.amountPaid - milestone.creditApplied);

/** What each event still owes: the open balance, the earliest due date, and how many milestones are past due. */
export function summarizeEventBalances(milestones: MilestoneFact[], todayKey: string): Map<string, BalanceSummary> {
  const summaries = new Map<string, BalanceSummary>();
  for (const milestone of milestones) {
    const balance = owed(milestone);
    if (balance === 0) continue;
    const dueKey = calendarDateKeyOf(milestone.dueDate);
    const current = summaries.get(milestone.eventId) ?? { balanceDue: 0, nextPaymentDue: null, overdueMilestones: 0 };
    summaries.set(milestone.eventId, {
      balanceDue: current.balanceDue + balance,
      nextPaymentDue: current.nextPaymentDue === null || dueKey < current.nextPaymentDue ? dueKey : current.nextPaymentDue,
      overdueMilestones: current.overdueMilestones + (dueKey < todayKey ? 1 : 0),
    });
  }
  return summaries;
}

export type ParticipationFact = { threadId: string; eventId: string; lastReadAt: Date | null };
export type MessageFact = { threadId: string; createdAt: Date };

/** Messages from other people newer than the actor's last read of that thread, summed per event. */
export function unreadMessagesByEvent(participations: ParticipationFact[], messages: MessageFact[]): Map<string, number> {
  const byThread = new Map(participations.map((participation) => [participation.threadId, participation]));
  const unread = new Map<string, number>();
  for (const message of messages) {
    const participation = byThread.get(message.threadId);
    if (!participation) continue;
    if (participation.lastReadAt && message.createdAt <= participation.lastReadAt) continue;
    unread.set(participation.eventId, (unread.get(participation.eventId) ?? 0) + 1);
  }
  return unread;
}

export function buildEventSummaries(balances: Map<string, BalanceSummary>, unread: Map<string, number>): PrismPmcmEventSummary[] {
  const eventIds = [...new Set([...balances.keys(), ...unread.keys()])].sort();
  return eventIds.map((eventId) => ({
    eventId,
    balanceDue: balances.get(eventId)?.balanceDue ?? 0,
    nextPaymentDue: balances.get(eventId)?.nextPaymentDue ?? null,
    overdueMilestones: balances.get(eventId)?.overdueMilestones ?? 0,
    unreadMessages: unread.get(eventId) ?? 0,
  }));
}

export type CalendarFacts = {
  from: string;
  to: string;
  events: Array<{ id: string; eventName: string; eventDate: Date }>;
  eventNames: Map<string, string>;
  quoteRequests: Array<{ id: string; eventId: string; supplierName: string; category: string; dueDate: Date }>;
  milestones: MilestoneFact[];
  ocularVisits: Array<{ id: string; eventId: string; scheduledAt: Date }>;
  schedules: Array<{ id: string; eventId: string; ingressAt: Date; egressAt: Date; location: string; supplierName: string }>;
};

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });

/** Every dated thing PMCM tracks across events, as calendar items inside [from, to], earliest first. */
export function buildPmcmCalendarItems(facts: CalendarFacts): PrismPmcmCalendarItem[] {
  const nameOf = (eventId: string) => facts.eventNames.get(eventId) ?? 'Event';
  const items: PrismPmcmCalendarItem[] = [];

  for (const event of facts.events) {
    items.push({ id: `event:${event.id}`, kind: 'event', eventId: event.id, eventName: event.eventName, date: calendarDateKeyOf(event.eventDate), detail: 'Event day' });
  }
  for (const request of facts.quoteRequests) {
    items.push({ id: `quote:${request.id}`, kind: 'quote_deadline', eventId: request.eventId, eventName: nameOf(request.eventId), date: manilaDateKeyOf(request.dueDate), detail: `${request.supplierName} · ${request.category} quote due` });
  }
  for (const milestone of facts.milestones) {
    if (owed(milestone) === 0) continue;
    items.push({ id: `payment:${milestone.id}`, kind: 'payment_due', eventId: milestone.eventId, eventName: nameOf(milestone.eventId), date: calendarDateKeyOf(milestone.dueDate), detail: `${milestone.label} · ${peso.format(owed(milestone))} due` });
  }
  for (const visit of facts.ocularVisits) {
    items.push({ id: `ocular:${visit.id}`, kind: 'ocular_visit', eventId: visit.eventId, eventName: nameOf(visit.eventId), date: manilaDateKeyOf(visit.scheduledAt), startTime: manilaClockOf(visit.scheduledAt), detail: 'Ocular visit' });
  }
  for (const schedule of facts.schedules) {
    const where = schedule.location ? ` · ${schedule.location}` : '';
    items.push(
      { id: `arrival:${schedule.id}`, kind: 'supplier_arrival', eventId: schedule.eventId, eventName: nameOf(schedule.eventId), date: manilaDateKeyOf(schedule.ingressAt), startTime: manilaClockOf(schedule.ingressAt), detail: `${schedule.supplierName} arrives${where}` },
      { id: `departure:${schedule.id}`, kind: 'supplier_departure', eventId: schedule.eventId, eventName: nameOf(schedule.eventId), date: manilaDateKeyOf(schedule.egressAt), startTime: manilaClockOf(schedule.egressAt), detail: `${schedule.supplierName} leaves${where}` },
    );
  }

  return items
    .filter((item) => item.date >= facts.from && item.date <= facts.to)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.id.localeCompare(b.id));
}
