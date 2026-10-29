import { daysUntil, dueLabel, manilaCalendarKey } from "@prism/ui/format-date";
import type { PrismEvent, PrismPaymentMilestone } from "@prism/types";
import type { ClientDashboardAction } from "../../workspace/model/client-dashboard-view-rules";
import type { ClientFigure as Figure, ClientRowTone } from "../../shared/client-list-ui";
import { clientMilestoneRemaining } from "../../billing/model/client-billing-rules";

const PAST_STATUSES = new Set(["completed", "cancelled", "closed"]);

export function isPastClientEvent(event: Pick<PrismEvent, "status" | "archived">) {
  return event.archived || PAST_STATUSES.has(event.status);
}

/** Upcoming events soonest first, then past events most recent first. */
export function orderClientEvents<T extends Pick<PrismEvent, "status" | "archived" | "eventDate">>(events: T[]): T[] {
  const upcoming = events.filter((event) => !isPastClientEvent(event)).sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""));
  const past = events.filter(isPastClientEvent).sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));
  return [...upcoming, ...past];
}

/** "In 12 days", "Today", "Tomorrow", "3 days ago": how far an event date is from today in Manila. */
export function eventCountdown(eventDate: string | null | undefined, todayKey: string): string | null {
  if (!eventDate) return null;
  const days = daysUntil(manilaCalendarKey(eventDate), todayKey);
  if (days === null) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  return days === -1 ? "Yesterday" : `${-days} days ago`;
}

/** The earliest unpaid milestone across the client's events, if any. */
export function nextClientPayment(payments: PrismPaymentMilestone[], eventIds: ReadonlySet<string>) {
  return payments
    .filter((payment) => eventIds.has(payment.eventId) && payment.status !== "paid" && clientMilestoneRemaining(payment) > 0)
    .sort((a, b) => String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? "")))[0];
}

/** Due phrase and urgency for a dated item; undated items have neither. */
export function dueState(dueAt: string | null | undefined, todayKey: string): { label: string; tone: ClientRowTone } | null {
  if (!dueAt) return null;
  const days = daysUntil(manilaCalendarKey(dueAt), todayKey);
  if (days === null) return null;
  return { label: dueLabel(days), tone: days < 0 ? "urgent" : days <= 2 ? "attention" : "neutral" };
}

/** Row colour for a client action: blockers are red or orange, later requirements stay grey. */
export function clientActionRowTone(action: ClientDashboardAction): ClientRowTone {
  if (action.priority === "critical") return "urgent";
  if (action.blocking || action.priority === "attention") return "attention";
  return "neutral";
}

type HrefFor = (route: "overview" | "billing", eventId: string) => string;
type MoneyFormat = (amount: number) => string;

function needsYouFigure(own: ClientDashboardAction[]): Figure {
  const blocking = own.filter((action) => action.blocking).length;
  if (blocking) return { label: "Needs you", value: own.length, detail: `${blocking} blocking now`, tone: "urgent" };
  if (own.length) return { label: "Needs you", value: own.length, detail: "Nothing blocking", tone: "attention" };
  return { label: "Needs you", value: 0, detail: "All caught up" };
}

function nextEventFigure(events: PrismEvent[], todayKey: string, hrefFor: HrefFor, formatDate: (value: string) => string): Figure {
  const next = orderClientEvents(events).find((event) => !isPastClientEvent(event));
  if (!next) return { label: "Next event", value: "—", detail: "No upcoming event" };
  return { label: "Next event", value: eventCountdown(next.eventDate, todayKey) ?? "Date pending", detail: `${next.eventName} · ${formatDate(next.eventDate)}`, href: hrefFor("overview", next.id) };
}

/** "Next payment" figure: the earliest unpaid milestone, red once it is overdue. */
export function nextPaymentFigure(payments: PrismPaymentMilestone[], eventIds: ReadonlySet<string>, todayKey: string, formatMoney: MoneyFormat, hrefFor?: HrefFor): Figure {
  const payment = nextClientPayment(payments, eventIds);
  if (!payment) return { label: "Next payment", value: "—", detail: "Nothing due" };
  const due = dueState(payment.dueDate, todayKey);
  return {
    label: "Next payment",
    value: formatMoney(clientMilestoneRemaining(payment)),
    detail: due ? `${payment.label} · ${due.label}` : payment.label,
    tone: due?.tone === "urgent" ? "urgent" : undefined,
    href: hrefFor?.("billing", payment.eventId),
  };
}

/** The four Home figures: what needs the client, what is with PMCM, the next event and the next payment. */
export function clientHomeFigures(input: {
  actions: ClientDashboardAction[];
  events: PrismEvent[];
  payments: PrismPaymentMilestone[];
  todayKey: string;
  hrefFor: HrefFor;
  formatMoney: MoneyFormat;
  formatDate: (value: string) => string;
}): Figure[] {
  const own = input.actions.filter((action) => (action.nextActor ?? "you") === "you");
  const withPmcm = input.actions.filter((action) => action.nextActor === "pmcm").length;
  const eventIds = new Set(input.events.map((event) => event.id));
  return [
    needsYouFigure(own),
    { label: "With PMCM", value: withPmcm, detail: withPmcm ? "Waiting on PMCM" : "Nothing pending" },
    nextEventFigure(input.events, input.todayKey, input.hrefFor, input.formatDate),
    nextPaymentFigure(input.payments, eventIds, input.todayKey, input.formatMoney, input.hrefFor),
  ];
}

/** Billing figures across every event: balance due, the next payment and how many are overdue. */
export function clientBillingAccountFigures(payments: PrismPaymentMilestone[], eventIds: ReadonlySet<string>, todayKey: string, formatMoney: MoneyFormat, hrefFor: HrefFor): Figure[] {
  const open = payments.filter((payment) => eventIds.has(payment.eventId) && payment.status !== "paid");
  const owed = open.reduce((sum, payment) => sum + clientMilestoneRemaining(payment), 0);
  const overdue = open.filter((payment) => dueState(payment.dueDate, todayKey)?.tone === "urgent").length;
  return [
    { label: "Balance due", value: owed ? formatMoney(owed) : "—", detail: owed ? `${open.length} open payment${open.length === 1 ? "" : "s"}` : "All paid" },
    nextPaymentFigure(payments, eventIds, todayKey, formatMoney, hrefFor),
    { label: "Overdue", value: overdue, tone: overdue ? "urgent" : undefined },
  ];
}
