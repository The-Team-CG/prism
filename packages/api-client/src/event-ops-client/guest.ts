import type {
  PrismGuestCheckIn,
  PrismGuestRosterEntry,
  PrismGuestEventPass,
  PrismGuestFeedback,
} from "@prism/types";
import { prismRequest, toQueryString } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts.js";
import { withBase, actorPath } from "./shared.js";

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
      checkIn: (accessCode, input) =>
        prismRequest<PrismGuestCheckIn>(
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
