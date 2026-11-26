import type {
  PrismGuestEventWatermark,
  PrismGuestFeedbackMediaUpload,
  PrismGuestFeedbackReceipt,
  PrismGuestQrPass,
  CoordinatorWalkInCheckInInput,
  PrismCoordinatorRegistrationEntry,
  PrismGuestCheckIn,
  PrismGuestCheckInReceipt,
  PrismGuestRosterEntry,
  PrismGuestEventPass,
  PrismGuestFeedback,
  PrismGuestPrivacyClassification,
  UpdateGuestPrivacyClassificationInput,
} from "@prism/types";
import { prismRequest, toQueryString } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase } from "./shared";

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
      watermark: (accessCode) =>
        prismRequest<PrismGuestEventWatermark>(
          `/guest/events/${encodeURIComponent(accessCode)}/watermark`,
          withBase(options),
        ),
      checkIn: (accessCode, input) =>
        prismRequest<PrismGuestCheckInReceipt>(
          `/guest/events/${encodeURIComponent(accessCode)}/check-ins`,
          withBase(options, { method: "POST", body: input }),
        ),
      feedback: (accessCode, input) =>
        prismRequest<PrismGuestFeedbackReceipt>(
          `/guest/events/${encodeURIComponent(accessCode)}/feedback`,
          withBase(options, { method: "POST", body: input }),
        ),
      uploadFeedbackMedia: (accessCode, file) =>
        prismRequest<PrismGuestFeedbackMediaUpload>(
          `/guest/events/${encodeURIComponent(accessCode)}/feedback-media`,
          withBase(options, {
            method: "POST",
            body: file,
            headers: { "Content-Type": file.type || "application/octet-stream", "x-prism-file-name": encodeURIComponent(file.name) },
          }),
        ),
      withdrawFeedbackConsent: (accessCode, feedbackId, input) =>
        prismRequest<PrismGuestFeedbackReceipt>(
          `/guest/events/${encodeURIComponent(accessCode)}/feedback/${encodeURIComponent(feedbackId)}/consent-withdrawal`,
          withBase(options, { method: "POST", body: input }),
        ),
      pendingFeedback: (eventId) =>
        prismRequest<PrismGuestFeedback[]>(
          `/guest/events/${eventId}/feedback/moderation`,
          withBase(options),
        ),
      moderateFeedback: (eventId, feedbackId, input) =>
        prismRequest<PrismGuestFeedback>(
          `/guest/events/${eventId}/feedback/${feedbackId}/moderate`,
          withBase(options, { method: "POST", body: input }),
        ),
      roster: (eventId, query = "") => {
        const params = toQueryString({
          ...(query.trim() ? { query: query.trim() } : {}),
        });
        return prismRequest<PrismGuestRosterEntry[]>(
          `/guest/events/${eventId}/roster${params ? `?${params}` : ""}`,
          withBase(options),
        );
      },
      searchRoster: (eventId, filters = {}) => {
        const params = toQueryString({ ...filters });
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
      importRoster: (eventId, input) =>
        prismRequest<PrismGuestRosterEntry[]>(
          `/guest/events/${eventId}/roster/import`,
          withBase(options, { method: "POST", body: input }),
        ),
      checkInRoster: (eventId, rosterEntryId) =>
        prismRequest<PrismGuestCheckIn>(
          `/guest/events/${eventId}/roster/${rosterEntryId}/check-in`,
          withBase(options, { method: "POST" }),
        ),
      verifyRoster: (eventId, rosterEntryId, input) =>
        prismRequest<PrismGuestRosterEntry>(
          `/guest/events/${eventId}/roster/${rosterEntryId}/verification`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      verifyRegistrationRoster: (eventId, rosterEntryId, input) =>
        prismRequest<PrismCoordinatorRegistrationEntry>(
          `/guest/events/${eventId}/roster/${rosterEntryId}/verification`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      flagWalkInForVerification: (eventId, rosterEntryId) =>
        prismRequest<PrismCoordinatorRegistrationEntry>(
          `/guest/events/${eventId}/roster/${rosterEntryId}/flag-for-verification`,
          withBase(options, { method: "POST" }),
        ),
      registerWalkIn: (eventId, input) =>
        prismRequest<PrismCoordinatorRegistrationEntry>(
          `/guest/events/${eventId}/walk-ins`,
          withBase(options, { method: "POST", body: input }),
        ),
      qrPasses: (eventId) =>
        prismRequest<PrismGuestQrPass[]>(`/guest/events/${encodeURIComponent(eventId)}/qr-passes`, withBase(options)),
      issueQrPasses: (eventId) =>
        prismRequest<PrismGuestQrPass[]>(`/guest/events/${encodeURIComponent(eventId)}/qr-passes`, withBase(options, { method: "POST" })),
      qrCheckIn: (eventId, input) =>
        prismRequest<PrismGuestCheckIn>(`/guest/events/${encodeURIComponent(eventId)}/qr-check-in`, withBase(options, { method: "POST", body: input })),
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
      walkInPolicy: (eventId) =>
        prismRequest(
          `/events/${eventId}/walk-in-policy`,
          withBase(options),
        ),
      updateWalkInPolicy: (eventId, input) =>
        prismRequest(
          `/events/${eventId}/walk-in-policy`,
          withBase(options, { method: "PATCH", body: input }),
        ),
    },
  };
}
