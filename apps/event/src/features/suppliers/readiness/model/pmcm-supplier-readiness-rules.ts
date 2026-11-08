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

/**
 * The one PMCM definition of an assigned supplier: a quote request whose supplier was selected. The sidebar
 * badge, the Bookings & contracts badge and rows, and Replace a supplier all count this; the API's Overview
 * count uses the same status.
 */
export function assignedSupplierRequests<T extends { status: string }>(requests: T[]): T[] {
  return requests.filter((request) => request.status === "selected");
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

type ScheduleWindow = { ingressAt: string; egressAt: string };
type ScheduledItem = { id: string; category: string; quoteStatus: string; schedule: ScheduleWindow | null };

/** Production is the category the schedule leads with; requests carry the category name, not an id. */
export function isProductionCategory(category: string) {
  return category.trim().toLowerCase() === "production";
}

/** Half-open windows: a supplier leaving as the next one arrives is not a conflict. */
export function scheduleWindowsOverlap(
  left: { ingressAt: string; egressAt: string },
  right: { ingressAt: string; egressAt: string },
) {
  return Date.parse(left.ingressAt) < Date.parse(right.egressAt) && Date.parse(right.ingressAt) < Date.parse(left.egressAt);
}

/** Item ids whose ingress window overlaps another selected supplier's window on the same event. */
export function scheduleConflictItemIds(items: Array<Pick<ScheduledItem, "id" | "quoteStatus" | "schedule">>) {
  const selected = items.filter((item): item is typeof item & { schedule: NonNullable<typeof item.schedule> } => item.quoteStatus === "selected" && item.schedule != null);
  const conflicting = new Set<string>();
  selected.forEach((left, index) => {
    for (const right of selected.slice(index + 1)) {
      if (!scheduleWindowsOverlap(left.schedule, right.schedule)) continue;
      conflicting.add(left.id);
      conflicting.add(right.id);
    }
  });
  return conflicting;
}

/** Default schedule order: production suppliers first, then by ingress start; suppliers without a window last. */
export function orderSupplierSchedule<T extends ScheduledItem>(items: T[]): T[] {
  const rank = (item: T) => [isProductionCategory(item.category) ? 0 : 1, item.schedule ? Date.parse(item.schedule.ingressAt) : Number.POSITIVE_INFINITY] as const;
  return items
    .map((item, index) => ({ item, index, rank: rank(item) }))
    .sort((left, right) => (left.rank[0] - right.rank[0]) || (left.rank[1] - right.rank[1]) || (left.index - right.index))
    .map(({ item }) => item);
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
