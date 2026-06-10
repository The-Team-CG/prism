export const PRISM_LIFECYCLE_STAGES = [
  "inquiry",
  "conforme",
  "briefing_proposal",
  "planning",
  "event_day",
  "closure_archive",
] as const;

export type PrismLifecycleStage = (typeof PRISM_LIFECYCLE_STAGES)[number];

export type PrismInquiryGateStatus =
  | "new"
  | "pending_review"
  | "accepted"
  | "declined"
  | "cancelled";

export type PrismConformeStatus = "not_required" | "pending" | "sent" | "signed" | "expired";

export interface PrismPortalGateInput {
  inquiryStatus: PrismInquiryGateStatus;
  conformeStatus: PrismConformeStatus;
}

export function canClientAccessPortal(input: PrismPortalGateInput): boolean {
  return input.inquiryStatus === "accepted" && input.conformeStatus === "signed";
}

export function canCreateEventWorkspace(input: PrismPortalGateInput): boolean {
  return canClientAccessPortal(input);
}
