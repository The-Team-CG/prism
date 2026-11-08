import type { PrismOwnPrivacyRequest, SubmitOwnPrivacyRequestInput } from "@prism/types";

export interface EventOpsPrivacyContract {
  privacy: {
    /** Files a privacy request for the signed-in client or supplier. The subject comes from the session, not the body. */
    submitOwnRequest(input: SubmitOwnPrivacyRequestInput): Promise<PrismOwnPrivacyRequest>;
    /** The signed-in client's or supplier's own requests, newest first. */
    listOwnRequests(): Promise<PrismOwnPrivacyRequest[]>;
  };
}
