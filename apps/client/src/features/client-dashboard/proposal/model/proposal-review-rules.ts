import type { PrismEvent, PrismDocument, ProposalRevisionArea, ReviewEventProposalInput } from "@prism/types";

export const CLIENT_PROPOSAL_REVISION_CAP = 3;

type PendingProposalDecision = {
  eventId: string;
  documentId: string;
  action: ReviewEventProposalInput["action"];
  revisionNote: string;
  revisionAreas: ProposalRevisionArea[];
  key: string;
};

/** The parts of a proposal a client can point PMCM at, in the order the dialog lists them. */
export const PROPOSAL_REVISION_AREA_OPTIONS: ReadonlyArray<{ value: ProposalRevisionArea; label: string }> = [
  { value: "venue", label: "Venue" },
  { value: "styling", label: "Styling" },
  { value: "budget", label: "Budget" },
  { value: "program", label: "Program" },
  { value: "guest_count", label: "Guest count" },
  { value: "suppliers", label: "Suppliers" },
  { value: "other", label: "Something else" },
];

export function latestIssuedProposal(documents: PrismDocument[]) {
  return documents.filter((document) =>
    ["proposal", "ce_proposal", "briefing_proposal"].includes(document.type) && document.status === "issued",
  ).sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt) || right.id.localeCompare(left.id))[0];
}

export function retainProposalDecisionKey(
  previous: PendingProposalDecision | null,
  input: Omit<PendingProposalDecision, "key">,
  createKey: () => string,
): PendingProposalDecision {
  const revisionNote = input.action === "request_revision" ? input.revisionNote.trim() : "";
  const revisionAreas = input.action === "request_revision" ? [...new Set(input.revisionAreas)].sort() : [];
  if (previous && previous.eventId === input.eventId && previous.documentId === input.documentId &&
    previous.action === input.action && previous.revisionNote === revisionNote &&
    previous.revisionAreas.join(",") === revisionAreas.join(",")) return previous;
  return { ...input, revisionNote, revisionAreas, key: createKey() };
}

export function proposalPackageReady(input: { briefing?: unknown; billing?: unknown; proposalIssued?: boolean }) {
  return Boolean(input.proposalIssued);
}

export function proposalClientStatus(event: PrismEvent) {
  return event.proposalClientStatus ?? "pending";
}

export function remainingProposalRevisions(event: PrismEvent) {
  return Math.max(0, CLIENT_PROPOSAL_REVISION_CAP - (event.proposalRevisionCount ?? 0));
}

/** Only the inquiry's primary contact decides; anyone else on the account can read and comment. */
export function canApproveProposal(event: PrismEvent, packageReady: boolean, isDecider: boolean) {
  return isDecider && packageReady && !event.archived && event.clientPortalStatus === "unlocked" && proposalClientStatus(event) === "pending";
}

export function canRequestProposalRevision(event: PrismEvent, packageReady: boolean, isDecider: boolean) {
  return canApproveProposal(event, packageReady, isDecider) && remainingProposalRevisions(event) > 0;
}

export function proposalReviewHeadline(event: PrismEvent, packageReady: boolean) {
  const status = proposalClientStatus(event);
  if (status === "approved") return "Proposal approved";
  if (status === "revision_requested") return "Changes requested. PMCM is preparing a new version.";
  if (!packageReady) return "PMCM is preparing your proposal";
  return "Your proposal is ready to review";
}
