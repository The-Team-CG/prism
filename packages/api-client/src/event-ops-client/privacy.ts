import type { PrismOwnPrivacyRequest, SubmitOwnPrivacyRequestInput } from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase } from "./shared";

export function createPrivacyClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "privacy"> {
  return {
    privacy: {
      submitOwnRequest: (input: SubmitOwnPrivacyRequestInput) =>
        prismRequest<PrismOwnPrivacyRequest>(
          "/privacy/requests/mine",
          withBase(options, { method: "POST", body: input }),
        ),
      listOwnRequests: () =>
        prismRequest<PrismOwnPrivacyRequest[]>(
          "/privacy/requests/mine",
          withBase(options),
        ),
    },
  };
}
