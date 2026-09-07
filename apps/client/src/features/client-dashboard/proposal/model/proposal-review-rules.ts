import type { PrismEvent } from "@prism/types";

export const CLIENT_PROPOSAL_REVISION_CAP = 3;

export function proposalPackageReady(input: { briefing?: unknown; billing?: unknown }) {
  return Boolean(input.briefing && input.billing);
}

export function proposalClientStatus(event: PrismEvent) {
  return event.proposalClientStatus ?? "pending";
}

export function remainingProposalRevisions(event: PrismEvent) {
  return Math.max(0, CLIENT_PROPOSAL_REVISION_CAP - (event.proposalRevisionCount ?? 0));
}

export function canApproveProposal(event: PrismEvent, packageReady: boolean) {
  return packageReady && proposalClientStatus(event) !== "approved";
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
