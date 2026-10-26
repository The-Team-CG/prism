import { describe, expect, it } from "vitest";
import { PRISM_PRIVACY_NOTICE_VERSION } from "@prism/types";
import { GuestApiError } from "@/features/guest-shared/guest-http";
import {
  buildCheckInPayload,
  buildFeedbackPayload,
  checkInButtonLabel,
  checkInSuccessNotice,
  guestApiPath,
  isFileWithinSizeLimit,
  isGuestAccessEndedError,
  isVideoDurationAllowed,
  MAX_FILE_SIZE_BYTES,
  MAX_VIDEO_DURATION_S,
  guestNextActions,
} from "./guest-dashboard-rules";
import type { GuestSession } from "./guest-dashboard-types";

const session = {
  eventName: "Yala",
  eventDate: "2026-08-01",
  clientName: "Ayala",
  guestAccessCode: "AYALA-TECH-YALA",
  readiness: "ready_for_event_day",
  floorPlanStatus: "approved",
  openedAt: "2026-07-01T00:00:00.000Z",
} as GuestSession;

describe("guest-dashboard-rules", () => {
  it("builds guest API paths from access code", () => {
    expect(guestApiPath(session)).toBe("/api/guest/events/AYALA-TECH-YALA");
    expect(guestApiPath(session, "/check-ins")).toBe(
      "/api/guest/events/AYALA-TECH-YALA/check-ins",
    );
  });

  it("builds only the fields allowed for the selected check-in mode", () => {
    const named = buildCheckInPayload({
      session,
      checkInMode: "name_search",
      guestName: "  Tess Green  ",
      consentAccepted: true,
    });
    expect(named).toEqual({
      checkInMode: "name_search",
      guestName: "Tess Green",
      privacyConsentAccepted: true,
      privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
      marketingConsentAccepted: false,
    });

    const headcount = buildCheckInPayload({
      session,
      checkInMode: "headcount",
      consentAccepted: true,
    });
    expect(headcount).toEqual({
      checkInMode: "headcount",
      privacyConsentAccepted: true,
      privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
      marketingConsentAccepted: false,
    });
  });

  it("does not build a public check-in payload without privacy consent", () => {
    expect(() => buildCheckInPayload({
      session,
      checkInMode: "headcount",
      consentAccepted: false,
    })).toThrow("Privacy consent is required to check in.");
  });

  it("uses generic check-in receipts and never exposes server review state", () => {
    expect(checkInSuccessNotice()).toBe("Check-in submitted.");
    expect(checkInButtonLabel(false)).toBe("Submit check-in");
  });

  it("enforces media size and video duration limits", () => {
    expect(isFileWithinSizeLimit(MAX_FILE_SIZE_BYTES)).toBe(true);
    expect(isFileWithinSizeLimit(MAX_FILE_SIZE_BYTES + 1)).toBe(false);
    expect(isVideoDurationAllowed(MAX_VIDEO_DURATION_S)).toBe(true);
    expect(isVideoDurationAllowed(MAX_VIDEO_DURATION_S + 0.1)).toBe(false);
  });

  it("builds feedback payload with optional media metadata", () => {
    const photo = new File(["x"], "shot.jpg", { type: "image/jpeg" });
    const payload = buildFeedbackPayload({
      session,
      guestName: "Maya Santos",
      rating: "4",
      comment: "Great",
      consentAccepted: true,
      photo,
    });
    expect(payload.rating).toBe(4);
    expect(payload.guestName).toBe("Maya Santos");
    expect(payload.photo?.fileName).toBe("shot.jpg");
    expect(payload.video).toBeUndefined();
  });

  it("derives the narrow guest action center from session actions", () => {
    expect(guestNextActions(false, false).map((item) => item.status)).toEqual(["pending", "pending"]);
    expect(guestNextActions(true, true).map((item) => item.status)).toEqual(["complete", "complete"]);
  });

  it("ends guest access only for auth and not-found responses from the API", () => {
    const apiError = (status: number) => new GuestApiError(status, "message");
    expect(isGuestAccessEndedError(apiError(401))).toBe(true);
    expect(isGuestAccessEndedError(apiError(403))).toBe(true);
    expect(isGuestAccessEndedError(apiError(404))).toBe(true);
    expect(isGuestAccessEndedError(apiError(410))).toBe(true);
    expect(isGuestAccessEndedError(apiError(500))).toBe(false);
    expect(isGuestAccessEndedError(new Error("network"))).toBe(false);
  });
});
