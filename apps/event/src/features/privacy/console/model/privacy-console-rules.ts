import {
  PRISM_PRIVACY_REQUEST_UNASSIGNED,
  type ListPrivacyRequestsQueryInput,
  type PrismPrivacyRequest,
  type PrivacyRequestStatusFilter,
} from "@prism/types";

export const PRIVACY_CONSOLE_PAGE_SIZE = 25;

export type PrivacyConsoleFilters = {
  eventId: string;
  status: PrivacyRequestStatusFilter;
  requestType: "all" | "access" | "correction" | "deletion" | "export";
  subjectType: "all" | "client" | "supplier" | "guest" | "account";
  deadline: "all" | "overdue" | "on-track";
  assignment: "all" | "mine" | "unassigned";
};

export const initialPrivacyConsoleFilters: PrivacyConsoleFilters = {
  eventId: "all",
  status: "all",
  requestType: "all",
  subjectType: "all",
  deadline: "all",
  assignment: "all",
};

/**
 * Turns the filter bar state into the API query. `mine` needs the signed-in operator id; without it the
 * assignment filter cannot be expressed, so the caller must not send the request.
 */
export function privacyQueueQuery(
  filters: PrivacyConsoleFilters,
  page: number,
  operatorId: string | null,
): ListPrivacyRequestsQueryInput | null {
  if (filters.assignment === "mine" && !operatorId) return null;
  const assignedTo = filters.assignment === "mine"
    ? operatorId ?? undefined
    : filters.assignment === "unassigned" ? PRISM_PRIVACY_REQUEST_UNASSIGNED : undefined;
  return {
    ...(filters.eventId !== "all" ? { eventId: filters.eventId } : {}),
    status: filters.status,
    requestType: filters.requestType,
    subjectType: filters.subjectType,
    ...(filters.deadline === "overdue" ? { overdue: "true" as const } : {}),
    ...(filters.deadline === "on-track" ? { overdue: "false" as const } : {}),
    ...(assignedTo ? { assignedTo } : {}),
    page,
    limit: PRIVACY_CONSOLE_PAGE_SIZE,
  };
}

/** Query string for the queue endpoint; empty filters are omitted so the API applies its defaults. */
export function privacyQueueSearch(query: ListPrivacyRequestsQueryInput): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const search = params.toString();
  return search ? `?${search}` : "";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Human deadline copy. Closed requests (executed or rejected) never show a countdown. */
export function privacyDeadlineLabel(request: Pick<PrismPrivacyRequest, "status" | "dueAt" | "overdue">, now: Date): string {
  const dueDate = request.dueAt.slice(0, 10);
  if (request.status === "executed" || request.status === "rejected") return "Closed";
  if (request.overdue) {
    const days = Math.max(1, Math.floor((now.getTime() - Date.parse(request.dueAt)) / DAY_MS));
    return `Overdue by ${days} ${days === 1 ? "day" : "days"} (due ${dueDate})`;
  }
  const daysLeft = Math.max(0, Math.ceil((Date.parse(request.dueAt) - now.getTime()) / DAY_MS));
  return `Due ${dueDate} (${daysLeft} ${daysLeft === 1 ? "day" : "days"} left)`;
}
