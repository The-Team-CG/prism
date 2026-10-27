import type { PrismClientWorkspace, PrismEvent } from "@prism/types";

export type ClientCalendarItemKind = "event" | "payment" | "visit" | "approval";

export interface ClientCalendarItem {
  id: string;
  date: string;
  title: string;
  detail: string;
  status: string;
  kind: ClientCalendarItemKind;
}

export type ClientCalendarView =
  | "calendar-event-dates"
  | "calendar-meetings"
  | "calendar-deadlines"
  | "calendar-payment-due-dates"
  | "calendar-approval-deadlines";

const VIEW_KINDS: Record<ClientCalendarView, ClientCalendarItemKind[]> = {
  "calendar-event-dates": ["event"],
  "calendar-meetings": ["visit"],
  "calendar-deadlines": ["payment"],
  "calendar-payment-due-dates": ["payment"],
  "calendar-approval-deadlines": ["approval"],
};

function isoDay(value: string) {
  return value.slice(0, 10);
}

type CalendarState = Pick<PrismClientWorkspace, "paymentMilestones" | "ocularVisits" | "clientEventTimelines">;
type CalendarEvent = Pick<PrismEvent, "id" | "eventName" | "eventDate" | "status">;

function eventDates(events: CalendarEvent[]): ClientCalendarItem[] {
  return events.map((event) => ({ id: `event-${event.id}`, date: isoDay(event.eventDate), title: event.eventName, detail: "Event date", status: event.status, kind: "event" }));
}

function paymentDates(state: CalendarState, byId: Map<string, CalendarEvent>): ClientCalendarItem[] {
  return state.paymentMilestones.flatMap((payment) => {
    const event = byId.get(payment.eventId);
    if (!event || !payment.dueDate) return [];
    return [{ id: `payment-${payment.id}`, date: isoDay(payment.dueDate), title: payment.label, detail: `${event.eventName} payment due`, status: payment.status, kind: "payment" as const }];
  });
}

function siteVisits(state: CalendarState, byId: Map<string, CalendarEvent>): ClientCalendarItem[] {
  return (state.ocularVisits ?? []).flatMap((visit) => {
    const event = byId.get(visit.eventId);
    if (!event || !visit.scheduledAt) return [];
    return [{ id: `visit-${visit.eventId}`, date: isoDay(visit.scheduledAt), title: "Site visit", detail: event.eventName, status: visit.status, kind: "visit" as const }];
  });
}

function layoutApprovals(state: CalendarState, byId: Map<string, CalendarEvent>): ClientCalendarItem[] {
  return state.clientEventTimelines.flatMap((timeline) => {
    const event = byId.get(timeline.eventId);
    const layout = timeline.milestones.find((milestone) => milestone.key === "floor_plan_approved");
    if (!event || !layout?.date || layout.status !== "completed") return [];
    return [{ id: `layout-${timeline.eventId}`, date: isoDay(layout.date), title: "Layout approved", detail: event.eventName, status: "approved", kind: "approval" as const }];
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
  const kinds = view && view in VIEW_KINDS ? VIEW_KINDS[view as ClientCalendarView] : null;
  return items
    .filter((item) => !kinds || kinds.includes(item.kind))
    .sort((a, b) => a.date.localeCompare(b.date));
}
