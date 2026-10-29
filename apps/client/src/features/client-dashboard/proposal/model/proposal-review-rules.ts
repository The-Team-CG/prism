import type { PrismEvent, PrismDocument, ReviewEventProposalInput } from "@prism/types";

export const CLIENT_PROPOSAL_REVISION_CAP = 3;

type PendingProposalDecision = {
  eventId: string;
  documentId: string;
  action: ReviewEventProposalInput["action"];
  revisionNote: string;
  key: string;
};

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
  if (previous && previous.eventId === input.eventId && previous.documentId === input.documentId &&
    previous.action === input.action && previous.revisionNote === revisionNote) return previous;
  return { ...input, revisionNote, key: createKey() };
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

export function canApproveProposal(event: PrismEvent, packageReady: boolean) {
  return packageReady && !event.archived && event.clientPortalStatus === "unlocked" && proposalClientStatus(event) === "pending";
}

export function canRequestProposalRevision(event: PrismEvent, packageReady: boolean) {
  return canApproveProposal(event, packageReady) && remainingProposalRevisions(event) > 0;
}

export function proposalReviewHeadline(event: PrismEvent, packageReady: boolean) {
  if (!packageReady) return "PMCM is preparing your proposal.";
  const status = proposalClientStatus(event);
  if (status === "approved") return "You approved this proposal.";
  if (status === "revision_requested") return "Revision requested. PMCM will update the package.";
  return "Proposal ready for review.";
}
