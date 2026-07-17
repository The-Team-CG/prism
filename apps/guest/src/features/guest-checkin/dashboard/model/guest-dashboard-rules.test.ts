import { describe, expect, it } from "vitest";
import {
  buildCheckInPayload,
  buildFeedbackPayload,
  checkInButtonLabel,
  checkInSuccessNotice,
  guestApiPath,
  isFileWithinSizeLimit,
  isVideoDurationAllowed,
  MAX_FILE_SIZE_BYTES,
  MAX_VIDEO_DURATION_S,
} from "./guest-dashboard-rules";
import type { GuestSession } from "./guest-dashboard-types";

const session = {
  eventName: "Yala",
  eventDate: "2026-08-01",
  clientName: "Ayala",
  guestAccessCode: "AYALA-TECH-YALA",
  readiness: "ready_for_event_day",
  floorPlanStatus: "approved",
  attendanceCount: 1,
  guestName: "Sofia Lim",
  openedAt: "2026-07-01T00:00:00.000Z",
} as GuestSession;

describe("guest-dashboard-rules", () => {
  it("builds guest API paths from access code", () => {
    expect(guestApiPath(session)).toBe("/api/guest/events/AYALA-TECH-YALA");
    expect(guestApiPath(session, "/check-ins")).toBe(
      "/api/guest/events/AYALA-TECH-YALA/check-ins",
    );
  });

  it("builds name and headcount check-in payloads", () => {
    const named = buildCheckInPayload({
      session,
      checkInMode: "name_search",
      walkIn: true,
      consentAccepted: true,
    });
    expect(named.guestName).toBe("Sofia Lim");
    expect(named.walkIn).toBe(true);
    expect(named.verificationStatus).toBe("flagged");

    const headcount = buildCheckInPayload({
      session,
      checkInMode: "headcount",
      walkIn: true,
      consentAccepted: true,
    });
    expect(headcount.guestName).toBe("Walk-in guest");
    expect(headcount.walkIn).toBe(false);
    expect(headcount.verificationStatus).toBe("verified");
  });

  it("derives check-in notices and button labels", () => {
    expect(checkInSuccessNotice("headcount", false)).toBe("Attendance recorded.");
    expect(checkInSuccessNotice("name_search", true)).toBe(
      "Walk-in flagged for PMCM review.",
    );
    expect(
      checkInButtonLabel({ checkedIn: false, checkInMode: "name_search", walkIn: true }),
    ).toBe("Submit walk-in for verification");
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
      rating: "4",
      comment: "Great",
      consentAccepted: true,
      photo,
    });
    expect(payload.rating).toBe(4);
    expect(payload.photo?.fileName).toBe("shot.jpg");
    expect(payload.video).toBeUndefined();
  });
});
