import { eventApi } from "@/lib/prism-api";
import type { PrismAddendum, PrismEventFreezeException, PrismScopeChangeRequest, ReviewScopeChangeRequestInput } from "@prism/types";

export const scopeReviewRepository = {
  async load(eventId: string): Promise<{ requests: PrismScopeChangeRequest[]; exceptions: PrismEventFreezeException[]; addenda: PrismAddendum[] }> {
    const [requests, exceptions, addenda] = await Promise.all([
      eventApi.events.scopeChangeRequests(eventId),
      eventApi.events.freezeExceptions(eventId),
      eventApi.events.addenda(eventId),
    ]);
    return { requests, exceptions, addenda };
  },
  review(eventId: string, requestId: string, input: ReviewScopeChangeRequestInput) {
    return eventApi.events.reviewScopeChangeRequest(eventId, requestId, input);
  },
};
