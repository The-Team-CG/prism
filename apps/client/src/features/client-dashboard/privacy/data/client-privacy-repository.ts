import type { PrismCurrentUser, PrismOwnPrivacyRequest, SubmitOwnPrivacyRequestInput } from "@prism/types";
import { defineResource } from "@prism/portal-query";
import { clientApi } from "@/lib/prism-api";

export type ClientPrivacyNotice = PrismCurrentUser["privacyNotice"];

export const clientPrivacyRequestRepository = {
  list(): Promise<PrismOwnPrivacyRequest[]> {
    return clientApi.privacy.listOwnRequests();
  },
  submit(input: SubmitOwnPrivacyRequestInput): Promise<PrismOwnPrivacyRequest> {
    return clientApi.privacy.submitOwnRequest(input);
  },
  cancel(requestId: string): Promise<PrismOwnPrivacyRequest> {
    return clientApi.privacy.cancelOwnRequest(requestId);
  },
  /** Which privacy notice version the signed-in client accepted, and when. */
  async notice(): Promise<ClientPrivacyNotice> {
    return (await clientApi.auth.me()).privacyNotice;
  },
};

/** The signed-in client's own privacy requests. Refreshed after each submission or cancellation. */
export const clientOwnPrivacyRequestsResource = defineResource<void, PrismOwnPrivacyRequest[]>({
  name: "client.own-privacy-requests",
  fetch: () => clientPrivacyRequestRepository.list(),
});

export const clientPrivacyNoticeResource = defineResource<void, ClientPrivacyNotice>({
  name: "client.privacy-notice",
  fetch: () => clientPrivacyRequestRepository.notice(),
});
