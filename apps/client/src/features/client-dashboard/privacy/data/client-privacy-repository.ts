import type { PrismOwnPrivacyRequest, SubmitOwnPrivacyRequestInput } from "@prism/types";
import { defineResource } from "@prism/portal-query";
import { clientApi } from "@/lib/prism-api";

export const clientPrivacyRequestRepository = {
  list(): Promise<PrismOwnPrivacyRequest[]> {
    return clientApi.privacy.listOwnRequests();
  },
  submit(input: SubmitOwnPrivacyRequestInput): Promise<PrismOwnPrivacyRequest> {
    return clientApi.privacy.submitOwnRequest(input);
  },
};

/** The signed-in client's own privacy requests. Refreshed after each submission. */
export const clientOwnPrivacyRequestsResource = defineResource<void, PrismOwnPrivacyRequest[]>({
  name: "client.own-privacy-requests",
  fetch: () => clientPrivacyRequestRepository.list(),
});
