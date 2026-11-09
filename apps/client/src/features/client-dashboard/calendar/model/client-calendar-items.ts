import { manilaCalendarKey } from "@prism/ui/format-date";
import type { PrismClientWorkspace, PrismEvent } from "@prism/types";

export type ClientCalendarItemKind = "event" | "payment" | "visit" | "approval";

export interface ClientCalendarItem {
  id: string;
  date: string;
  title: string;
  detail: string;
  status: string;
  kind: ClientCalendarItemKind;
  eventId: string;
}

export type ClientCalendarView =
  | "calendar-event-dates"
  | "calendar-meetings"
  | "calendar-deadlines"
  | "calendar-payment-due-dates"
  | "calendar-approval-deadlines";

/**
 * Due dates lists the payment dates still open; payment due dates is the whole schedule, paid milestones
 * included. Both are payment dates, so the open-only rule is what separates them.
 */
const VIEW_FILTERS: Record<ClientCalendarView, (item: ClientCalendarItem) => boolean> = {
  "calendar-event-dates": (item) => item.kind === "event",
  "calendar-meetings": (item) => item.kind === "visit",
  "calendar-deadlines": (item) => item.kind === "payment" && item.status !== "paid",
  "calendar-payment-due-dates": (item) => item.kind === "payment",
  "calendar-approval-deadlines": (item) => item.kind === "approval",
};

const VIEW_EMPTY_COPY: Record<ClientCalendarView, { title: string; description: string }> = {
  "calendar-event-dates": { title: "No event dates yet", description: "Event dates appear here once PMCM confirms the date of each event." },
  "calendar-meetings": { title: "No site visits scheduled", description: "Ocular visits PMCM schedules with you appear here." },
  "calendar-deadlines": { title: "No open due dates", description: "Payments that are still due appear here with their date." },
  "calendar-payment-due-dates": { title: "No payment due dates yet", description: "Your payment schedule appears here once PMCM posts it." },
  "calendar-approval-deadlines": { title: "No layout approvals yet", description: "The day each event layout is approved appears here." },
};

export const ALL_CALENDAR_EMPTY_COPY = { title: "Nothing scheduled yet", description: "Event dates, payment due dates, site visits and layout approvals appear here once they're set." };

/** Copy for an empty calendar view, so each tab says what would appear in it. */
export function clientCalendarEmptyCopy(view?: string): { title: string; description: string } {
  return view && view in VIEW_EMPTY_COPY ? VIEW_EMPTY_COPY[view as ClientCalendarView] : ALL_CALENDAR_EMPTY_COPY;
}

/** Calendar dates keep their day; timestamps land on their Philippine date. */
function isoDay(value: string) {
  return manilaCalendarKey(value);
}

type CalendarState = Pick<PrismClientWorkspace, "paymentMilestones" | "ocularVisits" | "clientEventTimelines">;
type CalendarEvent = Pick<PrismEvent, "id" | "eventName" | "eventDate" | "status">;

function eventDates(events: CalendarEvent[]): ClientCalendarItem[] {
  return events.map((event) => ({ id: `event-${event.id}`, date: isoDay(event.eventDate), title: event.eventName, detail: "Event date", status: event.status, kind: "event", eventId: event.id }));
}

function paymentDates(state: CalendarState, byId: Map<string, CalendarEvent>): ClientCalendarItem[] {
  return state.paymentMilestones.flatMap((payment) => {
    const event = byId.get(payment.eventId);
    if (!event || !payment.dueDate) return [];
    return [{ id: `payment-${payment.id}`, date: isoDay(payment.dueDate), title: payment.label, detail: `${event.eventName} payment due`, status: payment.status, kind: "payment" as const, eventId: event.id }];
  });
}

function siteVisits(state: CalendarState, byId: Map<string, CalendarEvent>): ClientCalendarItem[] {
  return (state.ocularVisits ?? []).flatMap((visit) => {
    const event = byId.get(visit.eventId);
    if (!event || !visit.scheduledAt) return [];
    return [{ id: `visit-${visit.eventId}`, date: isoDay(visit.scheduledAt), title: "Site visit", detail: event.eventName, status: visit.status, kind: "visit" as const, eventId: event.id }];
  });
}

function layoutApprovals(state: CalendarState, byId: Map<string, CalendarEvent>): ClientCalendarItem[] {
  return state.clientEventTimelines.flatMap((timeline) => {
    const event = byId.get(timeline.eventId);
    const layout = timeline.milestones.find((milestone) => milestone.key === "floor_plan_approved");
    if (!event || !layout?.date || layout.status !== "completed") return [];
    return [{ id: `layout-${timeline.eventId}`, date: isoDay(layout.date), title: "Layout approved", detail: event.eventName, status: "approved", kind: "approval" as const, eventId: event.id }];
  });
}

/**
 * Every dated entry the client calendar shows. Only dates PMCM or the client recorded appear:
 * event dates, payment due dates, scheduled site visits and the day a layout was approved.
 * Nothing is inferred from the event date.
 */
export function buildClientCalendarItems(state: CalendarState, events: CalendarEvent[], view?: string): ClientCalendarItem[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const items = [...eventDates(events), ...paymentDates(state, byId), ...siteVisits(state, byId), ...layoutApprovals(state, byId)];
  const matches = view && view in VIEW_FILTERS ? VIEW_FILTERS[view as ClientCalendarView] : () => true;
  return items
    .filter(matches)
    .sort((a, b) => a.date.localeCompare(b.date));
}
