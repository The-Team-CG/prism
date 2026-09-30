import { clientApi } from "@/lib/prism-api";
import type { PrismEvent, ReviewEventProposalInput } from "@prism/types";

export const proposalReviewRepository = {
  review(eventId: string, input: ReviewEventProposalInput): Promise<PrismEvent> {
    return clientApi.events.reviewProposal(eventId, input);
  },
};
