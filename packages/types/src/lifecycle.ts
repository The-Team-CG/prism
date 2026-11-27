/** PMCM's event flow (UAT 4.1): the briefing and proposal come before the conforme, and planning follows it. */
export const PRISM_LIFECYCLE_STAGES = [
  "inquiry",
  "briefing_proposal",
  "conforme",
  "planning",
  "event_day",
  "closure_archive",
] as const;

export type PrismLifecycleStage = (typeof PRISM_LIFECYCLE_STAGES)[number];

export const PRISM_LIFECYCLE_TRANSITIONS: Record<PrismLifecycleStage, PrismLifecycleStage[]> = {
  inquiry: ["briefing_proposal"],
  briefing_proposal: ["conforme"],
  conforme: ["planning"],
  planning: ["event_day"],
  event_day: ["closure_archive"],
  closure_archive: [],
};

export function nextPrismLifecycleStages(stage: PrismLifecycleStage): PrismLifecycleStage[] {
  return PRISM_LIFECYCLE_TRANSITIONS[stage];
}

export const PRISM_LIFECYCLE_STAGE_LABELS: Record<PrismLifecycleStage, string> = {
  inquiry: "Inquiry",
  briefing_proposal: "Briefing & proposal",
  conforme: "Conforme",
  planning: "Pre-planning",
  event_day: "Onsite",
  closure_archive: "Post-event",
};

export interface PrismLifecycleStageFacts {
  status: string;
  archived?: boolean;
  actualEndedAt?: string | Date | null;
  clientPortalStatus?: string;
  proposalClientStatus?: string | null;
}

/**
 * The client portal's access level. `locked`: no client access (a pre-conforme record PMCM opened before accepting
 * the inquiry). `limited`: the inquiry is accepted, so the client answers the briefing and reviews the proposal, and
 * nothing else. `unlocked`: the signed conforme activated the full portal.
 */
export const PRISM_CLIENT_PORTAL_STATUSES = ["locked", "limited", "unlocked"] as const;
export type PrismClientPortalStatus = (typeof PRISM_CLIENT_PORTAL_STATUSES)[number];

/** Whether the client can open the event at all: the briefing-and-proposal portal or the full one. */
export function isClientPortalOpen(status?: string | null): boolean {
  return status === "limited" || status === "unlocked";
}

/**
 * The one lifecycle stage for an event, used by the API's lifecycle guards and every portal. Accepting the inquiry
 * opens briefing & proposal; the client's proposal approval moves it to the conforme; the signed conforme starts
 * pre-planning. A submitted briefing or an approved floorplan does not move the stage on its own.
 */
export function derivePrismLifecycleStage(event: PrismLifecycleStageFacts): PrismLifecycleStage {
  if (event.archived || event.actualEndedAt || /^(completed|closed|archived)$/.test(event.status)) return "closure_archive";
  if (event.status === "event_day") return "event_day";
  const proposalApproved = event.proposalClientStatus === "approved";
  // Events activated by a conforme before the proposal (the earlier order) finish their proposal in this stage.
  if (event.clientPortalStatus === "unlocked") return proposalApproved ? "planning" : "briefing_proposal";
  if (event.clientPortalStatus === "limited") return proposalApproved ? "conforme" : "briefing_proposal";
  return "inquiry";
}

/**
 * A "date to be confirmed" decision keeps the previous date on the event until a postponement sets the new one, so
 * portals must not show that date as when the event happens or count down to it.
 */
export function isPrismEventDateConfirmed(event: Pick<PrismLifecycleStageFacts, "status">): boolean {
  return event.status !== "date_to_be_confirmed";
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
