import { manilaCalendarKey, manilaDateKey } from "@prism/ui/format-date";
import { PAYMENT_CALENDAR_LOOK, paymentCalendarState, type PortalCalendarLook } from "@prism/ui/portal-calendar";
import { formatPeso } from "@prism/ui/payment-track";
import type { PrismClientWorkspace, PrismEvent } from "@prism/types";

export type ClientCalendarItemKind = "event" | "payment" | "visit" | "approval";

export interface ClientCalendarItem {
  id: string;
  date: string;
  title: string;
  detail?: string;
  status: string;
  kind: ClientCalendarItemKind;
  eventId: string;
  /** The event the entry belongs to; left out on the event day itself. */
  eventName?: string;
  /** A short label for a month cell; payments say whether they are paid, late or due. */
  chipLabel?: string;
  look?: PortalCalendarLook;
  /** A payment past its date with money still owed. */
  overdue?: boolean;
  /** A paid payment or an approved layout. */
  done?: boolean;
  /** A payment's whole amount and what is still owed on it. */
  amount?: number;
  remaining?: number;
}

export type ClientCalendarView =
  | "calendar-event-dates"
  | "calendar-meetings"
  | "calendar-deadlines"
  | "calendar-payment-due-dates"
  | "calendar-approval-deadlines";

/**
 * The calendar links PMCM messages and older bookmarks use; each now opens the one calendar filtered to its kind.
 * Due dates are the payments still owed (paid ones hidden); the payment schedule is every payment.
 */
const VIEW_FILTERS: Record<ClientCalendarView, { kind: ClientCalendarItemKind; openOnly: boolean }> = {
  "calendar-event-dates": { kind: "event", openOnly: false },
  "calendar-meetings": { kind: "visit", openOnly: false },
  "calendar-deadlines": { kind: "payment", openOnly: true },
  "calendar-payment-due-dates": { kind: "payment", openOnly: false },
  "calendar-approval-deadlines": { kind: "approval", openOnly: false },
};

/** The category a calendar link opens on, and whether it hides what is done; nothing for the plain calendar. */
export function clientCalendarFilter(view?: string): { kind?: ClientCalendarItemKind; openOnly: boolean } {
  return view && view in VIEW_FILTERS ? VIEW_FILTERS[view as ClientCalendarView] : { openOnly: false };
}

/** Calendar dates keep their day; timestamps land on their Philippine date. */
function isoDay(value: string) {
  return manilaCalendarKey(value);
}

type CalendarState = Pick<PrismClientWorkspace, "paymentMilestones" | "ocularVisits" | "clientEventTimelines">;
type CalendarEvent = Pick<PrismEvent, "id" | "eventName" | "eventDate" | "status">;

function eventDates(events: CalendarEvent[]): ClientCalendarItem[] {
  return events.map((event) => ({ id: `event-${event.id}`, date: isoDay(event.eventDate), title: event.eventName, status: event.status, kind: "event", eventId: event.id }));
}

/** Each payment coloured by its state: paid, late, or still due. */
function paymentDates(state: CalendarState, byId: Map<string, CalendarEvent>, today: string): ClientCalendarItem[] {
  return state.paymentMilestones.flatMap((payment) => {
    const event = byId.get(payment.eventId);
    if (!event || !payment.dueDate) return [];
    const date = isoDay(payment.dueDate);
    const state = paymentCalendarState(date, today, payment.status === "paid");
    const look = PAYMENT_CALENDAR_LOOK[state];
    return [{
      id: `payment-${payment.id}`, date, title: payment.label, chipLabel: `${payment.label} ${look.word}`, eventName: event.eventName,
      status: payment.status, kind: "payment" as const, eventId: event.id, look: { chip: look.chip, dot: look.dot, label: look.label },
      overdue: state === "late", done: state === "paid", amount: payment.amount, remaining: payment.remainingBalance,
      detail: state === "paid" ? `${formatPeso(payment.amount)} paid` : `${formatPeso(payment.remainingBalance)} to pay`,
    }];
  });
}

function siteVisits(state: CalendarState, byId: Map<string, CalendarEvent>): ClientCalendarItem[] {
  return (state.ocularVisits ?? []).flatMap((visit) => {
    const event = byId.get(visit.eventId);
    if (!event || !visit.scheduledAt) return [];
    return [{ id: `visit-${visit.eventId}`, date: isoDay(visit.scheduledAt), title: "Site visit", eventName: event.eventName, status: visit.status, kind: "visit" as const, eventId: event.id }];
  });
}

function layoutApprovals(state: CalendarState, byId: Map<string, CalendarEvent>): ClientCalendarItem[] {
  return state.clientEventTimelines.flatMap((timeline) => {
    const event = byId.get(timeline.eventId);
    const layout = timeline.milestones.find((milestone) => milestone.key === "floor_plan_approved");
    if (!event || !layout?.date || layout.status !== "completed") return [];
    return [{ id: `layout-${timeline.eventId}`, date: isoDay(layout.date), title: "Layout approved", eventName: event.eventName, status: "approved", done: true, kind: "approval" as const, eventId: event.id }];
  });
}

/**
 * Every dated entry the client calendar shows. Only dates PMCM or the client recorded appear:
 * event dates, payment due dates, scheduled site visits and the day a layout was approved.
 * Nothing is inferred from the event date.
 */
export function buildClientCalendarItems(state: CalendarState, events: CalendarEvent[], today = manilaDateKey()): ClientCalendarItem[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const items = [...eventDates(events), ...paymentDates(state, byId, today), ...siteVisits(state, byId), ...layoutApprovals(state, byId)];
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
