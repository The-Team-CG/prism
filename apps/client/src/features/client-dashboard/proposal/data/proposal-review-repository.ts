import { prismApi } from "@/lib/prism-api";
import type { PrismEvent, ReviewEventProposalInput } from "@prism/types";

export const proposalReviewRepository = {
  review(eventId: string, input: ReviewEventProposalInput): Promise<PrismEvent> {
    return prismApi.reviewEventProposal(eventId, input);
  },
};
