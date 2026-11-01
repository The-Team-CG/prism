import type { PrismClientChangeRequest, SubmitScopeChangeRequestInput } from "@prism/types";
import { defineResource } from "@prism/portal-query";
import { clientApi } from "@/lib/prism-api";

export const clientChangeRequestRepository = {
  list(eventId: string): Promise<PrismClientChangeRequest[]> {
    return clientApi.events.changeRequests(eventId);
  },
  submitScopeChange(eventId: string, input: SubmitScopeChangeRequestInput) {
    return clientApi.events.submitScopeChangeRequest(eventId, input);
  },
  withdrawScopeChange(eventId: string, requestId: string) {
    return clientApi.events.withdrawScopeChangeRequest(eventId, requestId);
  },
};

/** The event's client-safe change requests, shared by the overview panel and prefetched when an event page opens. */
export const clientEventChangeRequestsResource = defineResource({
  name: "client.event-change-requests",
  fetch: (eventId: string) => clientChangeRequestRepository.list(eventId),
});
