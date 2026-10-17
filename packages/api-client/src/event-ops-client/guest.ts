import type {
  CoordinatorWalkInCheckInInput,
  PrismCoordinatorRegistrationEntry,
  PrismGuestCheckIn,
  PrismGuestCheckInReceipt,
  PrismGuestRosterEntry,
  PrismGuestEventPass,
  PrismGuestFeedback,
  PrismGuestPrivacyClassification,
  UpdateGuestPrivacyClassificationInput,
  PrismGuestQrPassIssueResult,
  PrismGuestQrPassRosterStatus,
  PrismGuestQrPassStatus,
} from "@prism/types";
import { prismRequest, toQueryString } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase, actorPath } from "./shared";

export function createGuestClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "guest"> {
  return {
    guest: {
      eventPass: (accessCode) =>
        prismRequest<PrismGuestEventPass>(
          `/guest/events/${encodeURIComponent(accessCode)}`,
          withBase(options),
        ),
      guestQrPasses: (eventId, rosterEntryIds) =>
        prismRequest<PrismGuestQrPassRosterStatus>(
          `/events/${encodeURIComponent(eventId)}/guest-qr-passes/status`,
          withBase(options, { method: "POST", body: { rosterEntryIds } }),
        ),
      issueGuestQrPass: (eventId, rosterEntryId) =>
        prismRequest<PrismGuestQrPassIssueResult>(
          `/events/${encodeURIComponent(eventId)}/guest-qr-passes/roster/${encodeURIComponent(rosterEntryId)}`,
          withBase(options, { method: "POST" }),
        ),
      retryGuestQrPass: (eventId, passId) =>
        prismRequest<PrismGuestQrPassStatus>(
          `/events/${encodeURIComponent(eventId)}/guest-qr-passes/${encodeURIComponent(passId)}/retry`,
          withBase(options, { method: "POST" }),
        ),
      reissueGuestQrPass: (eventId, passId) =>
        prismRequest<PrismGuestQrPassIssueResult>(
          `/events/${encodeURIComponent(eventId)}/guest-qr-passes/${encodeURIComponent(passId)}/reissue`,
          withBase(options, { method: "POST" }),
        ),
      revokeGuestQrPass: (eventId, passId) =>
        prismRequest<PrismGuestQrPassStatus>(
          `/events/${encodeURIComponent(eventId)}/guest-qr-passes/${encodeURIComponent(passId)}/revoke`,
          withBase(options, { method: "POST" }),
        ),
      checkIn: (accessCode, input) =>
        prismRequest<PrismGuestCheckInReceipt>(
          `/guest/events/${encodeURIComponent(accessCode)}/check-ins`,
          withBase(options, { method: "POST", body: input }),
        ),
      feedback: (accessCode, input) =>
        prismRequest<PrismGuestFeedback>(
          `/guest/events/${encodeURIComponent(accessCode)}/feedback`,
          withBase(options, { method: "POST", body: input }),
        ),
      withdrawFeedbackConsent: (accessCode, feedbackId, input) =>
        prismRequest<PrismGuestFeedback>(
          `/guest/events/${encodeURIComponent(accessCode)}/feedback/${encodeURIComponent(feedbackId)}/consent-withdrawal`,
          withBase(options, { method: "POST", body: input }),
        ),
      pendingFeedback: (eventId, actor = {}) =>
        prismRequest<PrismGuestFeedback[]>(
          actorPath(`/guest/events/${eventId}/feedback/moderation`, actor),
          withBase(options),
        ),
      moderateFeedback: (eventId, feedbackId, input, actor = {}) =>
        prismRequest<PrismGuestFeedback>(
          actorPath(
            `/guest/events/${eventId}/feedback/${feedbackId}/moderate`,
            actor,
          ),
          withBase(options, { method: "POST", body: input }),
        ),
      roster: (eventId, query = "", actor = {}) => {
        const params = toQueryString({
          ...actor,
          ...(query.trim() ? { query: query.trim() } : {}),
        });
        return prismRequest<PrismGuestRosterEntry[]>(
          `/guest/events/${eventId}/roster${params ? `?${params}` : ""}`,
          withBase(options),
        );
      },
      searchRoster: (eventId, filters = {}, actor = {}) => {
        const params = toQueryString({ ...actor, ...filters });
        return prismRequest<PrismGuestRosterEntry[]>(
          `/guest/events/${eventId}/roster/search${params ? `?${params}` : ""}`,
          withBase(options),
        );
      },
      registrationRoster: (eventId, filters = {}) => {
        const params = toQueryString(filters);
        return prismRequest<PrismCoordinatorRegistrationEntry[]>(
          `/guest/events/${eventId}/roster/search${params ? `?${params}` : ""}`,
          withBase(options),
        );
      },
      importRoster: (eventId, input, actor = {}) =>
        prismRequest<PrismGuestRosterEntry[]>(
          actorPath(`/guest/events/${eventId}/roster/import`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      checkInRoster: (eventId, rosterEntryId, actor = {}) =>
        prismRequest<PrismGuestCheckIn>(
          actorPath(
            `/guest/events/${eventId}/roster/${rosterEntryId}/check-in`,
            actor,
          ),
          withBase(options, { method: "POST" }),
        ),
      verifyRoster: (eventId, rosterEntryId, input, actor = {}) =>
        prismRequest<PrismGuestRosterEntry>(
          actorPath(
            `/guest/events/${eventId}/roster/${rosterEntryId}/verification`,
            actor,
          ),
          withBase(options, { method: "PATCH", body: input }),
        ),
      verifyRegistrationRoster: (eventId, rosterEntryId, input) =>
        prismRequest<PrismCoordinatorRegistrationEntry>(
          `/guest/events/${eventId}/roster/${rosterEntryId}/verification`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      registerWalkIn: (eventId, input) =>
        prismRequest<PrismCoordinatorRegistrationEntry>(
          `/guest/events/${eventId}/walk-ins`,
          withBase(options, { method: "POST", body: input }),
        ),
      guestPrivacyClassification: (eventId) =>
        prismRequest<PrismGuestPrivacyClassification>(
          `/events/${encodeURIComponent(eventId)}/guest-privacy`,
          withBase(options),
        ),
      updateGuestPrivacyClassification: (eventId, input) =>
        prismRequest<PrismGuestPrivacyClassification>(
          `/events/${encodeURIComponent(eventId)}/guest-privacy`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      walkInPolicy: (eventId, actor = {}) =>
        prismRequest(
          actorPath(`/events/${eventId}/walk-in-policy`, actor),
          withBase(options),
        ),
      updateWalkInPolicy: (eventId, input, actor = {}) =>
        prismRequest(
          actorPath(`/events/${eventId}/walk-in-policy`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
    },
  };
}
