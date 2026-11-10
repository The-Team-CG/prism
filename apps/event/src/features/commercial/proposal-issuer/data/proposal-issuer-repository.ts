import type { CreateCostEstimateInput, IssueProposalVersionInput, ProposalDraftRequest } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const proposalIssuerRepository = {
  latest: (eventId: string) => eventApi.commercial.proposal(eventId),
  createEstimate: (eventId: string, input: CreateCostEstimateInput) => eventApi.commercial.createCostEstimate(eventId, input),
  issue: (eventId: string, input: IssueProposalVersionInput) => eventApi.commercial.issueProposalVersion(eventId, input),
  selectedQuoteLines: (eventId: string) => eventApi.commercial.selectedQuoteLines(eventId),
  previousEstimates: (eventId: string) => eventApi.commercial.previousCostEstimates(eventId),
  draftWording: (input: ProposalDraftRequest) => eventApi.commercial.draftProposalWording(input),
};
