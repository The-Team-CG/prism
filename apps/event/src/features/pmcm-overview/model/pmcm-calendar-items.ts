import { PAYMENT_CALENDAR_LOOK, paymentCalendarState, type PortalCalendarItem, type PortalCalendarKind } from "@prism/ui/portal-calendar";
import { manilaDateKey } from "@prism/ui/format-date";
import { addDays, type VisibleRange } from "@prism/ui/calendar-views";
import type { PmcmCalendarQuery, PrismPmcmCalendarItem, PrismPmcmCalendarItemKind } from "@prism/types";

/** The event workspace section where each kind of dated work is handled. */
export type PmcmCalendarTarget = "overview" | "suppliers" | "billing";

export type PmcmCalendarEntry = PortalCalendarItem & { eventId: string; target: PmcmCalendarTarget; scheduleDayId?: string };

const TARGETS: Record<PrismPmcmCalendarItemKind, PmcmCalendarTarget> = {
  event: "overview",
  ocular_visit: "overview",
  quote_deadline: "suppliers",
  payment_due: "billing",
  supplier_arrival: "suppliers",
  supplier_departure: "suppliers",
  schedule_day: "overview",
};

const CHIP_LABELS: Record<PrismPmcmCalendarItemKind, string | null> = {
  event: null,
  ocular_visit: "Ocular visit",
  quote_deadline: "Quote due",
  payment_due: "Payment due",
  supplier_arrival: "Arrival",
  supplier_departure: "Departure",
  schedule_day: null,
};

export const PMCM_CALENDAR_KINDS: Record<PrismPmcmCalendarItemKind, PortalCalendarKind> = {
  event: { label: "Event day", chip: "bg-primary/10 text-primary hover:bg-primary/15", dot: "bg-primary" },
  ocular_visit: { label: "Ocular visit", chip: "bg-info-soft text-info hover:bg-info/15", dot: "bg-info" },
  quote_deadline: { label: "Quote deadline", chip: "bg-attention-soft text-attention hover:bg-attention/15", dot: "bg-attention" },
  payment_due: { label: "Payment due", chip: "bg-attention-soft text-attention hover:bg-attention/15", dot: "bg-attention" },
  supplier_arrival: { label: "Supplier arrival", chip: "bg-secondary text-foreground hover:bg-secondary/80", dot: "bg-foreground/60" },
  supplier_departure: { label: "Supplier departure", chip: "bg-muted text-foreground hover:bg-muted/80", dot: "bg-muted-foreground" },
  schedule_day: { label: "Event-day schedule", chip: "bg-accent text-accent-foreground hover:bg-accent/80", dot: "bg-accent-foreground" },
};

/** Open payments on the PMCM calendar: late once their date has passed, otherwise due. */
function paymentLook(item: PrismPmcmCalendarItem, today: string): Pick<PmcmCalendarEntry, "look" | "chipLabel"> {
  if (item.kind !== "payment_due") return {};
  const state = paymentCalendarState(item.date, today, false);
  const { chip, dot, label } = PAYMENT_CALENDAR_LOOK[state];
  return { look: { chip, dot, label }, chipLabel: label };
}

/** The event is the headline of its own day; every other kind leads with what is due and shows the event under it. */
export function toCalendarEntries(items: PrismPmcmCalendarItem[], today = manilaDateKey()): PmcmCalendarEntry[] {
  return items.map((item) => ({
    id: item.id,
    date: item.date,
    kind: item.kind,
    eventId: item.eventId,
    target: TARGETS[item.kind],
    scheduleDayId: item.scheduleDayId,
    title: item.kind === "event" ? item.eventName : item.detail,
    chipLabel: CHIP_LABELS[item.kind] ?? item.eventName,
    detail: item.kind === "event" ? item.detail : item.eventName,
    startTime: item.startTime,
    ...paymentLook(item, today),
  }));
}

const startOfMonth = (dateKey: string) => `${dateKey.slice(0, 7)}-01`;
const endOfMonth = (dateKey: string) => addDays(startOfMonth(addDays(startOfMonth(dateKey), 32)), -1);

/**
 * What to load for the dates on screen: those dates widened to whole months, plus the month on each side.
 * Browsing month to month then reuses what is loaded instead of asking again at every step.
 */
export function calendarWindow(range: VisibleRange): PmcmCalendarQuery {
  return {
    from: startOfMonth(addDays(startOfMonth(range.from), -1)),
    to: endOfMonth(addDays(endOfMonth(range.to), 1)),
  };
}
