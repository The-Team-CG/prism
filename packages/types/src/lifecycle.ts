export const PRISM_LIFECYCLE_STAGES = [
  "inquiry",
  "conforme",
  "briefing_proposal",
  "planning",
  "event_day",
  "closure_archive",
] as const;

export type PrismLifecycleStage = (typeof PRISM_LIFECYCLE_STAGES)[number];

export const PRISM_LIFECYCLE_TRANSITIONS: Record<PrismLifecycleStage, PrismLifecycleStage[]> = {
  inquiry: ["conforme"],
  conforme: ["briefing_proposal"],
  briefing_proposal: ["planning"],
  planning: ["event_day"],
  event_day: ["closure_archive"],
  closure_archive: [],
};

export function nextPrismLifecycleStages(stage: PrismLifecycleStage): PrismLifecycleStage[] {
  return PRISM_LIFECYCLE_TRANSITIONS[stage];
}

export const PRISM_LIFECYCLE_STAGE_LABELS: Record<PrismLifecycleStage, string> = {
  inquiry: "Inquiry",
  conforme: "Conforme",
  briefing_proposal: "Briefing & proposal",
  planning: "Planning",
  event_day: "Event day",
  closure_archive: "Closure",
};

export interface PrismLifecycleStageFacts {
  status: string;
  archived?: boolean;
  actualEndedAt?: string | Date | null;
  clientPortalStatus?: string;
  proposalClientStatus?: string | null;
}

/**
 * The one lifecycle stage for an event, used by the API's lifecycle guards and every portal. Planning starts
 * when the client approves the proposal: a submitted briefing (which sets the operational status to
 * `planning`) or an approved floorplan does not move the stage on its own.
 */
export function derivePrismLifecycleStage(event: PrismLifecycleStageFacts): PrismLifecycleStage {
  if (event.archived || event.actualEndedAt || /^(completed|closed|archived)$/.test(event.status)) return "closure_archive";
  if (event.status === "event_day") return "event_day";
  if (event.clientPortalStatus !== "unlocked") return "conforme";
  if (event.proposalClientStatus === "approved") return "planning";
  return "briefing_proposal";
}

export function isBeforePrismEventDay(stage: PrismLifecycleStage): boolean {
  return PRISM_LIFECYCLE_STAGES.indexOf(stage) < PRISM_LIFECYCLE_STAGES.indexOf("event_day");
}

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
