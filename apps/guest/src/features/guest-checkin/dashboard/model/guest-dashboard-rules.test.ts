import { describe, expect, it } from "vitest";
import { PRISM_PRIVACY_NOTICE_VERSION, type PrismGuestSession } from "@prism/types";
import { GuestApiError } from "@/features/guest-shared/guest-http";
import {
  buildCheckInPayload,
  buildFeedbackPayload,
  formatArrivalTime,
  formatPassDate,
  guestCalendarFile,
  guestCountdownLabel,
  guestPassMoment,
  isFileWithinSizeLimit,
  isGuestAccessEndedError,
  isGuestCheckInOpen,
  isVideoDurationAllowed,
  MAX_FILE_SIZE_BYTES,
  MAX_VIDEO_DURATION_S,
} from "./guest-dashboard-rules";

const session = {
  eventName: "Yala",
  eventDate: "2026-08-01",
  clientName: "Ayala",
  guestAccessCode: "AYALA-TECH-YALA",
  readiness: "ready_for_event_day",
  floorPlanStatus: "approved",
  openedAt: "2026-07-01T00:00:00.000Z",
} as PrismGuestSession;

describe("guest-dashboard-rules", () => {
  it("shows the start time and the weekday a guest plans around", () => {
    expect(formatArrivalTime("18:30")).toBe("6:30 PM");
    expect(formatArrivalTime("00:05")).toBe("12:05 AM");
    expect(formatPassDate("2026-08-01")).toBe("Sat, Aug 1");
  });

  it("leads with the invitation before the day, check-in on the day, and feedback once it opens", () => {
    const pass = { ...session, feedbackAvailability: "not_open" as const };
    expect(guestPassMoment(pass, new Date("2026-07-31T15:00:00Z"))).toBe("before");
    expect(guestPassMoment(pass, new Date("2026-07-31T16:30:00Z"))).toBe("today");
    expect(guestPassMoment({ ...pass, feedbackAvailability: "open" }, new Date("2026-08-02T00:00:00Z"))).toBe("after");
  });

  it("counts down to the day in Philippine time and stops on the day", () => {
    expect(guestCountdownLabel("2026-08-01", new Date("2026-07-22T03:00:00Z"))).toBe("10 days to go");
    expect(guestCountdownLabel("2026-08-01", new Date("2026-07-31T03:00:00Z"))).toBe("Tomorrow");
    expect(guestCountdownLabel("2026-08-01", new Date("2026-07-31T17:00:00Z"))).toBeNull();
  });

  it("writes a calendar entry in Philippine time, all-day when no start time is confirmed", () => {
    const now = new Date("2026-07-01T00:00:00Z");
    const timed = guestCalendarFile({ ...session, id: "evt_1", eventName: "Yala, Night; One", venue: "Grand Ballroom, Makati", startTime: "18:30" }, now);
    expect(timed).toContain("DTSTART;TZID=Asia/Manila:20260801T183000");
    expect(timed).toContain("SUMMARY:Yala\\, Night\\; One");
    expect(timed).toContain("LOCATION:Grand Ballroom\\, Makati");
    expect(timed.split("\r\n")).toContain("UID:evt_1@prism-guest-pass");

    const allDay = guestCalendarFile({ ...session, id: "evt_1" }, now);
    expect(allDay).toContain("DTSTART;VALUE=DATE:20260801");
    expect(allDay).not.toContain("LOCATION");
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

  it("enforces media size and video duration limits", () => {
    expect(isFileWithinSizeLimit(MAX_FILE_SIZE_BYTES)).toBe(true);
    expect(isFileWithinSizeLimit(MAX_FILE_SIZE_BYTES + 1)).toBe(false);
    expect(isVideoDurationAllowed(MAX_VIDEO_DURATION_S)).toBe(true);
    expect(isVideoDurationAllowed(MAX_VIDEO_DURATION_S + 0.1)).toBe(false);
  });

  it("builds feedback payload with the stored media ids", () => {
    const payload = buildFeedbackPayload({
      session,
      guestName: "Maya Santos",
      rating: "4",
      comment: "Great",
      consentAccepted: true,
      photoObjectId: "obj_photo",
    });
    expect(payload.rating).toBe(4);
    expect(payload.guestName).toBe("Maya Santos");
    expect(payload.photoObjectId).toBe("obj_photo");
    expect(payload).not.toHaveProperty("videoObjectId");
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

  it("opens check-in on the event's Philippine calendar day, not months before", () => {
    const now = new Date("2026-11-01T02:00:00Z");
    expect(isGuestCheckInOpen("2027-06-15", now)).toBe(false);
    expect(isGuestCheckInOpen("2026-11-01", now)).toBe(true);
    expect(isGuestCheckInOpen("2026-10-31", now)).toBe(true);
  });
});
