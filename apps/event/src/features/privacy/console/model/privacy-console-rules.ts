import {
  PRISM_PRIVACY_REQUEST_UNASSIGNED,
  type ListPrivacyRequestsQueryInput,
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
/** Executed, rejected and withdrawn requests are closed: no countdown and no actions. */
export function isClosedPrivacyRequest(status: string): boolean {
  return status === "executed" || status === "rejected" || status === "cancelled";
}

