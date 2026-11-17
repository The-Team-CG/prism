import type { PrismCurrentUser, PrismOwnPrivacyDownload, PrismOwnPrivacyRequest, SubmitOwnPrivacyRequestInput } from "@prism/types";
import { defineResource } from "@prism/portal-query";
import { supplierApi } from "@/lib/prism-api";

export type SupplierPrivacyNotice = PrismCurrentUser["privacyNotice"];

export const supplierPrivacyRequestRepository = {
  list(): Promise<PrismOwnPrivacyRequest[]> {
    return supplierApi.privacy.listOwnRequests();
  },
  submit(input: SubmitOwnPrivacyRequestInput): Promise<PrismOwnPrivacyRequest> {
    return supplierApi.privacy.submitOwnRequest(input);
  },
  /** The signed-in supplier's own data straight away, confirmed with their password. */
  download(password: string): Promise<PrismOwnPrivacyDownload> {
    return supplierApi.privacy.downloadOwnData({ password });
  },
  cancel(requestId: string): Promise<PrismOwnPrivacyRequest> {
    return supplierApi.privacy.cancelOwnRequest(requestId);
  },
  /** Which privacy notice version the signed-in supplier accepted, and when. */
  async notice(): Promise<SupplierPrivacyNotice> {
    return (await supplierApi.auth.me()).privacyNotice;
  },
};

/** The signed-in supplier's own privacy requests. Refreshed after each submission or cancellation. */
export const supplierOwnPrivacyRequestsResource = defineResource<void, PrismOwnPrivacyRequest[]>({
  name: "supplier.own-privacy-requests",
  fetch: () => supplierPrivacyRequestRepository.list(),
});

export const supplierPrivacyNoticeResource = defineResource<void, SupplierPrivacyNotice>({
  name: "supplier.privacy-notice",
  fetch: () => supplierPrivacyRequestRepository.notice(),
});
