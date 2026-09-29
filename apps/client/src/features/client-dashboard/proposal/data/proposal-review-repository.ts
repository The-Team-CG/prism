import { clientApi, isClientLocalDemoMode } from "@/lib/prism-api";
import { prismApi as samplePrismApi } from "@/compatibility/sample/prism-api";
import type { PrismEvent, ReviewEventProposalInput } from "@prism/types";

export const proposalReviewRepository = {
  review(eventId: string, input: ReviewEventProposalInput): Promise<PrismEvent> {
    if (isClientLocalDemoMode) return samplePrismApi.reviewEventProposal(eventId, input);
    return clientApi.events.reviewProposal(eventId, input);
  },
};
