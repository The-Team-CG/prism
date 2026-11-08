import type { PrismOwnPrivacyRequest, SubmitOwnPrivacyRequestInput } from "@prism/types";
import { defineResource } from "@prism/portal-query";
import { supplierApi } from "@/lib/prism-api";

export const supplierPrivacyRequestRepository = {
  list(): Promise<PrismOwnPrivacyRequest[]> {
    return supplierApi.privacy.listOwnRequests();
  },
  submit(input: SubmitOwnPrivacyRequestInput): Promise<PrismOwnPrivacyRequest> {
    return supplierApi.privacy.submitOwnRequest(input);
  },
};

/** The signed-in supplier's own privacy requests. Refreshed after each submission. */
export const supplierOwnPrivacyRequestsResource = defineResource<void, PrismOwnPrivacyRequest[]>({
  name: "supplier.own-privacy-requests",
  fetch: () => supplierPrivacyRequestRepository.list(),
});
