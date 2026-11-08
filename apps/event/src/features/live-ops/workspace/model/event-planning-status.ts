import type { PrismEvent } from "@prism/types";

/** FR-05: proposal rounds the client may request before PMCM must record a scope change instead. */
export const PROPOSAL_REVISION_LIMIT = 3;

const PROPOSAL_STAGE: Record<string, string> = {
  pending: "Awaiting client review",
  revision_requested: "Revision requested",
  approved: "Approved",
};
const FLOOR_PLAN_STAGE: Record<string, string> = {
  not_started: "Not started",
  pmcm_draft: "PMCM drafting",
  client_submitted: "Client preference received",
  in_review: "Awaiting client approval",
  revision_requested: "Revision requested",
  approved: "Approved",
};

export function eventPlanningStatus(event: Pick<PrismEvent, "proposalClientStatus" | "proposalRevisionCount" | "floorPlanStatus" | "clientPortalStatus">) {
  const rounds = event.proposalRevisionCount ?? 0;
  return [
    { label: "Proposal", value: event.proposalClientStatus ? PROPOSAL_STAGE[event.proposalClientStatus] ?? event.proposalClientStatus : "Not issued" },
    { label: "Revision rounds", value: `${rounds} of ${PROPOSAL_REVISION_LIMIT}`, warn: rounds >= PROPOSAL_REVISION_LIMIT },
    { label: "Floor plan", value: FLOOR_PLAN_STAGE[event.floorPlanStatus] ?? event.floorPlanStatus },
    { label: "Client portal", value: event.clientPortalStatus === "unlocked" ? "Open" : "Locked" },
  ];
}
