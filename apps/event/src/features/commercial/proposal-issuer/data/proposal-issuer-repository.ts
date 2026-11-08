import type {
  CreateCostEstimateInput,
  IssueProposalVersionInput,
  PrismCostEstimate,
  PrismEstimateLineSource,
  PrismEventProposalResponse,
  PrismPreviousCostEstimate,
  PrismProposalVersion,
  ProposalDraftRequest,
  ProposalDraftResponse,
} from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const proposalIssuerRepository = {
  latest: (eventId: string) => eventApiRequest<PrismEventProposalResponse>(`/api/events/${eventId}/proposal`),
  createEstimate: (eventId: string, input: CreateCostEstimateInput) =>
    eventApiRequest<PrismCostEstimate>(`/api/events/${eventId}/cost-estimates`, { method: "POST", body: input }),
  issue: (eventId: string, input: IssueProposalVersionInput) =>
    eventApiRequest<PrismProposalVersion>(`/api/events/${eventId}/proposal/versions`, { method: "POST", body: input }),
  selectedQuoteLines: (eventId: string) => eventApiRequest<PrismEstimateLineSource[]>(`/api/events/${eventId}/cost-estimates/supplier-quote-lines`),
  previousEstimates: (eventId: string) => eventApiRequest<PrismPreviousCostEstimate[]>(`/api/events/${eventId}/cost-estimates/previous`),
  draftWording: (input: ProposalDraftRequest) =>
    eventApiRequest<ProposalDraftResponse>("/api/proposal-drafts", { method: "POST", body: input }),
};
