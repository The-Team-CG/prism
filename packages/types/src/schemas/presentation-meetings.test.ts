import { describe, expect, it } from "vitest";
import { meetingLinkPlatform, presentationMeetingPlatform, proposePresentationMeetingSchema } from "./presentation-meetings.js";

const slots = [
  { startsAt: "2026-12-01T02:00:00.000Z", endsAt: "2026-12-01T03:00:00.000Z" },
  { startsAt: "2026-12-02T02:00:00.000Z", endsAt: "2026-12-02T03:00:00.000Z" },
];

describe("presentation meeting platforms (UAT 7.6)", () => {
  it("names the platform of a meeting link, and nothing for look-alike hosts", () => {
    expect(meetingLinkPlatform("https://us02web.zoom.us/j/123")).toBe("zoom");
    expect(meetingLinkPlatform("https://meet.google.com/abc-defg-hij")).toBe("google_meet");
    expect(meetingLinkPlatform("https://teams.microsoft.com/l/meetup-join/x")).toBe("teams");
    expect(meetingLinkPlatform("https://zoomXus.example/j/1")).toBeNull();
    expect(meetingLinkPlatform("not a link")).toBeNull();
    expect(presentationMeetingPlatform({ zoomMeeting: true, meetingLink: null })).toBe("zoom");
  });

  it("accepts a link on the chosen platform and refuses a mismatch or an automatic non-Zoom meeting", () => {
    const base = { title: "Proposal presentation", slots };
    expect(proposePresentationMeetingSchema.safeParse({ ...base, platform: "google_meet", meetingLink: "https://meet.google.com/abc" }).success).toBe(true);
    expect(proposePresentationMeetingSchema.safeParse({ ...base, platform: "zoom", createZoomMeeting: true }).success).toBe(true);
    expect(proposePresentationMeetingSchema.safeParse({ ...base, platform: "teams", meetingLink: "https://meet.google.com/abc" }).success).toBe(false);
    expect(proposePresentationMeetingSchema.safeParse({ ...base, platform: "teams", createZoomMeeting: true }).success).toBe(false);
  });
});
