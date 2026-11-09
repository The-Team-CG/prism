import type { PrismNotificationPreferences, PrismOwnPrivacyRequest, PrismViberLink, SubmitOwnPrivacyRequestInput, UpdateNotificationPreferencesInput } from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase } from "./shared";

export function createPrivacyClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "privacy" | "notificationPreferences"> {
  return {
    notificationPreferences: {
      mine: () => prismRequest<PrismNotificationPreferences>("/notification-preferences/me", withBase(options)),
      setViberEnabled: (input: UpdateNotificationPreferencesInput) =>
        prismRequest<PrismNotificationPreferences>("/notification-preferences/me", withBase(options, { method: "PATCH", body: input })),
      startViberLink: () => prismRequest<PrismViberLink>("/notification-preferences/viber-link", withBase(options, { method: "POST" })),
      unlinkViber: () => prismRequest<PrismNotificationPreferences>("/notification-preferences/viber", withBase(options, { method: "DELETE" })),
    },
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
