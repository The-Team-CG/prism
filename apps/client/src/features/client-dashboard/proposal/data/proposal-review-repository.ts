import { clientApi, clientApiRequest } from "@/lib/prism-api";
import type { PrismEvent, PrismEventProposalResponse, ReviewEventProposalInput } from "@prism/types";

export const proposalReviewRepository = {
  latest(eventId: string) {
    return clientApiRequest<PrismEventProposalResponse>(`/events/${eventId}/proposal`);
  },
  review(eventId: string, input: ReviewEventProposalInput): Promise<PrismEvent> {
    return clientApi.events.reviewProposal(eventId, input);
  },
};
