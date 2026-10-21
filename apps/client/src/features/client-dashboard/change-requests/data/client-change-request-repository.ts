import type { PrismClientChangeRequest, SubmitScopeChangeRequestInput } from "@prism/types";
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
