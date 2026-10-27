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

/**
 * Every dated entry the client calendar shows. Only dates PMCM or the client recorded appear:
 * event dates, payment due dates, scheduled site visits and the day a layout was approved.
 * Nothing is inferred from the event date.
 */
export function buildClientCalendarItems(
  state: Pick<PrismClientWorkspace, "paymentMilestones" | "ocularVisits" | "clientEventTimelines">,
  events: Array<Pick<PrismEvent, "id" | "eventName" | "eventDate" | "status">>,
  view?: string,
): ClientCalendarItem[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const items: ClientCalendarItem[] = [];

  for (const event of events) {
    items.push({ id: `event-${event.id}`, date: isoDay(event.eventDate), title: event.eventName, detail: "Event date", status: event.status, kind: "event" });
  }
  for (const payment of state.paymentMilestones) {
    const event = byId.get(payment.eventId);
    if (!event || !payment.dueDate) continue;
    items.push({ id: `payment-${payment.id}`, date: isoDay(payment.dueDate), title: payment.label, detail: `${event.eventName} payment due`, status: payment.status, kind: "payment" });
  }
  for (const visit of state.ocularVisits ?? []) {
    const event = byId.get(visit.eventId);
    if (!event || !visit.scheduledAt) continue;
    items.push({ id: `visit-${visit.eventId}`, date: isoDay(visit.scheduledAt), title: "Site visit", detail: event.eventName, status: visit.status, kind: "visit" });
  }
  for (const timeline of state.clientEventTimelines) {
    const event = byId.get(timeline.eventId);
    const layout = timeline.milestones.find((milestone) => milestone.key === "floor_plan_approved");
    if (!event || !layout?.date || layout.status !== "completed") continue;
    items.push({ id: `layout-${timeline.eventId}`, date: isoDay(layout.date), title: "Layout approved", detail: event.eventName, status: "approved", kind: "approval" });
  }

  const kinds = view && view in VIEW_KINDS ? VIEW_KINDS[view as ClientCalendarView] : null;
  return items
    .filter((item) => !kinds || kinds.includes(item.kind))
    .sort((a, b) => a.date.localeCompare(b.date));
}
