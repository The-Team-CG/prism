import type { PrismClientChangeRequest, ScopeChangeCategory } from "@prism/types";

export function clientChangeRequestStatusLabel(status: PrismClientChangeRequest["status"]): string {
  if (status === "approved") return "Approved";
  if (status === "not_approved") return "Not approved";
  if (status === "withdrawn") return "Withdrawn";
  return "Under review";
}

/** Only a scope change still under review can be withdrawn; PMCM decides whether it is still open. */
export function canWithdrawClientChangeRequest(request: Pick<PrismClientChangeRequest, "source" | "status">): boolean {
  return request.source === "scope_change" && request.status === "under_review";
}

export const scopeChangeCategoryOptions: ReadonlyArray<{ value: ScopeChangeCategory; label: string }> = [
  { value: "program", label: "Programme" },
  { value: "venue", label: "Venue" },
  { value: "guest_count", label: "Guest count" },
  { value: "styling", label: "Styling and décor" },
  { value: "supplier", label: "Supplier" },
  { value: "schedule", label: "Schedule" },
  { value: "other", label: "Other" },
];
