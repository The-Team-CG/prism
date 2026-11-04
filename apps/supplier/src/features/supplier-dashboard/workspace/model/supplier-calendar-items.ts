import type { PrismSupplierWorkflowWorkspace } from "@prism/types";
import { formatPortalTime, manilaCalendarKey } from "@prism/ui/format-date";
import { formatMoney, isRequestClosed } from "./supplier-workspace-rules";
import type { PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, SupplierWorkspace } from "./supplier-workspace-types";
import { buildQuoteByRequest } from "./supplier-workspace-rules";
import { supplierSectionHref, supplierWorkTargetHref } from "./supplier-workspace-types";

export type SupplierCalendarItemKind = "event" | "deadline" | "arrival" | "departure" | "deliverable" | "payment";

export type SupplierCalendarItem = {
  id: string;
  date: string;
  title: string;
  chipLabel: string;
  detail: string;
  kind: SupplierCalendarItemKind;
  href: string;
};

const OPEN_TASK_STATUSES = ["open", "in_progress", "changes_requested"];
const UNPAID_PAYABLE_STATUSES = ["scheduled", "partially_released"];

/** Everything dated on the supplier's own work; each item links to the place it is acted on. */
export function buildSupplierCalendarItems(
  workspace: Pick<SupplierWorkspace, "quoteRequests" | "supplierQuotes">,
  readinessBoard: PrismSupplierReadinessBoard | null,
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null,
): SupplierCalendarItem[] {
  const quoteByRequest = buildQuoteByRequest(workspace.supplierQuotes);
  const requests = new Map(workspace.quoteRequests.map((request) => [request.id, request]));
  const readiness = readinessBoard?.items ?? [];
  const eventNames = new Map(readiness.map((item) => [item.eventId, item.eventName]));
  const eventName = (eventId: string) => eventNames.get(eventId) ?? "Assigned event";
  const isLive = (request: PrismSupplierQuoteRequest) => !isRequestClosed(request, quoteByRequest.get(request.id));
  const isBooked = (request: PrismSupplierQuoteRequest) => request.status === "selected";
  const items: SupplierCalendarItem[] = [];

  for (const request of workspace.quoteRequests) {
    if (request.dueDate && isLive(request)) {
      items.push({ id: `deadline:${request.id}`, date: request.dueDate, title: `Quote due: ${request.category}`, chipLabel: "Quote due", detail: eventName(request.eventId), kind: "deadline", href: supplierWorkTargetHref("requests", request.id) });
    }
  }

  // One entry per event day; a booking on that event is the most useful place to land.
  const eventDays = new Map<string, SupplierCalendarItem>();
  for (const item of readiness) {
    const request = requests.get(item.requestId);
    if (!item.eventDate || !request || !(isBooked(request) || isLive(request))) continue;
    if (eventDays.has(item.eventId) && !isBooked(request)) continue;
    eventDays.set(item.eventId, {
      id: `event:${item.eventId}`,
      date: item.eventDate,
      title: item.eventName ?? "Assigned event",
      chipLabel: "Event day",
      detail: `Event day · ${item.category}`,
      kind: "event",
      href: supplierWorkTargetHref(isBooked(request) ? "bookings" : "requests", request.id),
    });
  }
  items.push(...eventDays.values());

  for (const schedule of workflowWorkspace?.schedules ?? []) {
    if (schedule.status === "cancelled") continue;
    const href = supplierWorkTargetHref("bookings", schedule.requestId);
    const name = eventName(schedule.eventId);
    items.push(
      { id: `arrival:${schedule.id}`, date: manilaCalendarKey(schedule.ingressAt), title: `Arrive: ${name}`, chipLabel: "Arrive", detail: `${formatPortalTime(schedule.ingressAt)} · ${schedule.location}`, kind: "arrival", href },
      { id: `departure:${schedule.id}`, date: manilaCalendarKey(schedule.egressAt), title: `Leave: ${name}`, chipLabel: "Leave", detail: `${formatPortalTime(schedule.egressAt)} · ${schedule.location}`, kind: "departure", href },
    );
  }

  for (const task of workflowWorkspace?.creativeTasks ?? []) {
    if (!task.dueAt || !OPEN_TASK_STATUSES.includes(task.status)) continue;
    items.push({ id: `deliverable:${task.id}`, date: manilaCalendarKey(task.dueAt), title: `Due: ${task.title}`, chipLabel: task.title, detail: eventName(task.eventId), kind: "deliverable", href: supplierWorkTargetHref("bookings", task.requestId) });
  }

  for (const payable of workflowWorkspace?.payables ?? []) {
    if (!payable.dueDate || !UNPAID_PAYABLE_STATUSES.includes(payable.status)) continue;
    items.push({ id: `payment:${payable.id}`, date: manilaCalendarKey(payable.dueDate), title: `Payment: ${payable.label}`, chipLabel: payable.label, detail: `${formatMoney(payable.remainingBalance)} · ${eventName(payable.eventId)}`, kind: "payment", href: supplierSectionHref("payments") });
  }

  return items.sort((left, right) => left.date.localeCompare(right.date));
}
