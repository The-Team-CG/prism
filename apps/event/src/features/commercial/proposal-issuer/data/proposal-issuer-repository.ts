import type {
  CreateCostEstimateInput,
  IssueProposalVersionInput,
  PrismCostEstimate,
  PrismEventProposalResponse,
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
  draftWording: (input: ProposalDraftRequest) =>
    eventApiRequest<ProposalDraftResponse>("/api/proposal-drafts", { method: "POST", body: input }),
};
