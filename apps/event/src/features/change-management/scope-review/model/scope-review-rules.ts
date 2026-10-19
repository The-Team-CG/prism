import type { PrismScopeChangeRequest, PrismScopeChangeStatus, ScopeChangeCategory } from "@prism/types";

export const scopeChangeCategoryLabels: Record<ScopeChangeCategory, string> = {
  program: "Programme",
  venue: "Venue",
  guest_count: "Guest count",
  styling: "Styling and décor",
  supplier: "Supplier",
  schedule: "Schedule",
  other: "Other",
};

const STATUS_LABELS: Record<PrismScopeChangeStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn by client",
};

export function scopeChangeStatusLabel(status: PrismScopeChangeStatus): string {
  return STATUS_LABELS[status];
}

/** A request PMCM can still start reviewing, approve, or reject. */
export function isOpenScopeChange(request: Pick<PrismScopeChangeRequest, "status">): boolean {
  return request.status === "submitted" || request.status === "under_review";
}

export function impactLabels(impacts: PrismScopeChangeRequest["impacts"]): string[] {
  return [
    impacts.billing ? "Billing" : null,
    impacts.supplier ? "Supplier" : null,
    impacts.coordinator ? "Coordinator" : null,
    impacts.floorplan ? "Floorplan" : null,
  ].filter((label): label is string => label !== null);
}
