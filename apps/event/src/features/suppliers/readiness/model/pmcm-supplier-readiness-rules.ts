import type {
  PrismPmcmSupplierReadinessItem,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessConcernKind,
  PrismSupplierReadinessSetupStatus,
} from "@prism/types";

/**
 * Readiness is computed by the API (same builder as the supplier portal). These helpers only
 * summarize the server items for PMCM; they never re-derive readiness from quotes.
 */
export function categoriesWithSupplierGap(items: Array<Pick<PrismPmcmSupplierReadinessItem, "category" | "quoteLocked">>) {
  const lockedByCategory = new Map<string, boolean>();
  for (const item of items) {
    lockedByCategory.set(item.category, (lockedByCategory.get(item.category) ?? false) || item.quoteLocked);
  }
  return [...lockedByCategory.entries()].filter(([, locked]) => !locked).map(([category]) => category);
}

export function supplierGapHardBlockCopy(categories: string[]) {
  if (categories.length === 0) return null;
  return `Do not advance planning until a supplier is selected in: ${categories.join(", ")}.`;
}

/** Changes whenever a planner action may have changed server readiness, so the board refetches. */
export function supplierReadinessRefreshKey(
  requests: Array<Pick<PrismSupplierQuoteRequest, "id" | "status" | "assignmentStatus" | "readinessStatus" | "eventDayStatus">>,
) {
  return requests
    .map((request) => [request.id, request.status, request.assignmentStatus, request.readinessStatus, request.eventDayStatus].join(":"))
    .sort()
    .join("|");
}

const SETUP_LABELS: Record<PrismSupplierReadinessSetupStatus, string> = {
  not_started: "Setup not started",
  late: "Ingress late",
  arrived: "Arrived",
  ready: "Set up ready",
  complete: "Done and leaving",
};

export function setupStatusLabel(status: PrismSupplierReadinessSetupStatus) {
  return SETUP_LABELS[status];
}

const CONCERN_LABELS: Record<PrismSupplierReadinessConcernKind, string> = {
  schedule_change_request: "Schedule change requested",
  contract_correction: "Contract correction",
  event_day_note: "Event-day note",
};

export function concernLabel(kind: PrismSupplierReadinessConcernKind) {
  return CONCERN_LABELS[kind];
}
