import type { PrismSupplierWorkflowWorkspace } from "@prism/types";
import { manilaCalendarKey, manilaClockKey, manilaDateKey } from "@prism/ui/format-date";
import { PAYMENT_CALENDAR_LOOK, paymentCalendarState, type PortalCalendarLook } from "@prism/ui/portal-calendar";
import { buildQuoteByRequest, formatMoney, isRequestClosed } from "./supplier-workspace-rules";
import type { PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, SupplierWorkspace } from "./supplier-workspace-types";
import { supplierSectionHref, supplierWorkTargetHref } from "./supplier-workspace-types";

export type SupplierCalendarItemKind = "event" | "deadline" | "arrival" | "departure" | "deliverable" | "payment";

export type SupplierCalendarItem = {
  id: string;
  date: string;
  title: string;
  chipLabel: string;
  /** The agenda's extra line: the place of an arrival or departure, what is left to receive on a payment. */
  detail?: string;
  kind: SupplierCalendarItemKind;
  href: string;
  eventId: string;
  /** The event the entry belongs to; left out on the event day itself. */
  eventName?: string;
  /** What the supplier is booked or quoting for. */
  category?: string;
  /** Philippine wall-clock time, HH:mm; absent for all-day items. */
  startTime?: string;
  /** Payments are coloured late once PMCM has missed their date. */
  look?: PortalCalendarLook;
  /** A payment PMCM has not made by its date. */
  overdue?: boolean;
  /** What PMCM still owes on a payment. */
  amount?: number;
};

type ReadinessItems = PrismSupplierReadinessBoard["items"];
type EventName = (eventId: string) => string;
type IsLive = (request: PrismSupplierQuoteRequest) => boolean;

const OPEN_TASK_STATUSES = ["open", "in_progress", "changes_requested"];
const UNPAID_PAYABLE_STATUSES = ["scheduled", "partially_released"];

const isBooked = (request: PrismSupplierQuoteRequest) => request.status === "selected";

function deadlineItems(requests: PrismSupplierQuoteRequest[], isLive: IsLive, eventName: EventName): SupplierCalendarItem[] {
  return requests.filter((request) => request.dueDate && isLive(request)).map((request) => ({
    id: `deadline:${request.id}`,
    date: request.dueDate as string,
    title: `${request.category} quote due`,
    chipLabel: "Quote due",
    eventId: request.eventId,
    eventName: eventName(request.eventId),
    category: request.category,
    kind: "deadline",
    href: supplierWorkTargetHref("requests", request.id),
  }));
}

/** One entry per event day; a booking on that event is the most useful place to land. */
function eventDayItems(readiness: ReadinessItems, requests: PrismSupplierQuoteRequest[], isLive: IsLive): SupplierCalendarItem[] {
  const byId = new Map(requests.map((request) => [request.id, request]));
  const eventDays = new Map<string, SupplierCalendarItem>();
  for (const item of readiness) {
    const request = byId.get(item.requestId);
    if (!item.eventDate || !request || !(isBooked(request) || isLive(request))) continue;
    if (eventDays.has(item.eventId) && !isBooked(request)) continue;
    eventDays.set(item.eventId, {
      id: `event:${item.eventId}`,
      date: item.eventDate,
      title: item.eventName ?? "Assigned event",
      chipLabel: item.eventName ?? "Assigned event",
      eventId: item.eventId,
      category: item.category,
      kind: "event",
      href: supplierWorkTargetHref(isBooked(request) ? "bookings" : "requests", request.id),
    });
  }
  return [...eventDays.values()];
}

function scheduleItems(workflow: PrismSupplierWorkflowWorkspace, eventName: EventName): SupplierCalendarItem[] {
  return workflow.schedules.filter((schedule) => schedule.status !== "cancelled").flatMap((schedule): SupplierCalendarItem[] => {
    const shared = { href: supplierWorkTargetHref("bookings", schedule.requestId), eventId: schedule.eventId, eventName: eventName(schedule.eventId), detail: schedule.location };
    return [
      { ...shared, id: `arrival:${schedule.id}`, date: manilaCalendarKey(schedule.ingressAt), title: "Arrival", chipLabel: "Arrive", kind: "arrival", startTime: manilaClockKey(schedule.ingressAt) },
      { ...shared, id: `departure:${schedule.id}`, date: manilaCalendarKey(schedule.egressAt), title: "Departure", chipLabel: "Leave", kind: "departure", startTime: manilaClockKey(schedule.egressAt) },
    ];
  });
}

function deliverableItems(workflow: PrismSupplierWorkflowWorkspace, eventName: EventName): SupplierCalendarItem[] {
  return workflow.creativeTasks.filter((task) => task.dueAt && OPEN_TASK_STATUSES.includes(task.status)).map((task) => ({
    id: `deliverable:${task.id}`,
    date: manilaCalendarKey(task.dueAt as string),
    title: task.title,
    chipLabel: task.title,
    eventId: task.eventId,
    eventName: eventName(task.eventId),
    kind: "deliverable",
    href: supplierWorkTargetHref("bookings", task.requestId),
    startTime: manilaClockKey(task.dueAt as string),
  }));
}

function paymentItems(workflow: PrismSupplierWorkflowWorkspace, eventName: EventName, today: string): SupplierCalendarItem[] {
  return workflow.payables.filter((payable) => payable.dueDate && UNPAID_PAYABLE_STATUSES.includes(payable.status)).map((payable) => {
    const date = manilaCalendarKey(payable.dueDate as string);
    const state = paymentCalendarState(date, today, false);
    const look = PAYMENT_CALENDAR_LOOK[state];
    return {
      id: `payment:${payable.id}`,
      date,
      title: payable.label,
      chipLabel: `${payable.label} ${look.word}`,
      detail: `${formatMoney(payable.remainingBalance)} to receive`,
      eventId: payable.eventId,
      eventName: eventName(payable.eventId),
      kind: "payment",
      href: supplierSectionHref("payments"),
      look: { chip: look.chip, dot: look.dot, label: look.label },
      overdue: state === "late",
      amount: payable.remainingBalance,
    };
  });
}

/** Everything dated on the supplier's own work; each item links to the place it is acted on. */
export function buildSupplierCalendarItems(
  workspace: Pick<SupplierWorkspace, "quoteRequests" | "supplierQuotes">,
  readinessBoard: PrismSupplierReadinessBoard | null,
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null,
  today = manilaDateKey(),
): SupplierCalendarItem[] {
  const quoteByRequest = buildQuoteByRequest(workspace.supplierQuotes);
  const readiness = readinessBoard?.items ?? [];
  const eventNames = new Map(readiness.map((item) => [item.eventId, item.eventName]));
  const eventName: EventName = (eventId) => eventNames.get(eventId) ?? "Assigned event";
  const isLive: IsLive = (request) => !isRequestClosed(request, quoteByRequest.get(request.id));

  return [
    ...deadlineItems(workspace.quoteRequests, isLive, eventName),
    ...eventDayItems(readiness, workspace.quoteRequests, isLive),
    ...(workflowWorkspace
      ? [...scheduleItems(workflowWorkspace, eventName), ...deliverableItems(workflowWorkspace, eventName), ...paymentItems(workflowWorkspace, eventName, today)]
      : []),
  ].sort((left, right) => left.date.localeCompare(right.date));
}
