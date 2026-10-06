import { describe, expect, it } from "vitest";
import {
  buildGuestSession,
  encodeAccessCodePath,
  isOpenDraftValid,
  normalizeAccessCode,
  resolvePostOpenPath,
} from "./guest-access-open-rules";
import type { PrismGuestEventPass } from "@prism/types";

const sampleEvent = {
  id: "evt_1",
  eventName: "Yala Tech Night",
  eventDate: "2026-08-01",
  clientName: "Ayala",
  guestAccessCode: "AYALA-TECH-YALA",
  watermark: "2026-08-01T00:00:00.000Z",
  guestName: "Legacy Name",
  readiness: "ready_for_event_day",
  floorPlanStatus: "approved",
  attendanceCount: 12,
} as PrismGuestEventPass;

describe("guest-access-open-rules", () => {
  it("normalizes access codes", () => {
    expect(normalizeAccessCode("  ayala-tech-yala ")).toBe("AYALA-TECH-YALA");
  });

  it("validates draft fields", () => {
    expect(isOpenDraftValid({ accessCode: "CODE" })).toBe(true);
    expect(isOpenDraftValid({ accessCode: "  " })).toBe(false);
  });

  it("encodes path segment from raw code", () => {
    expect(encodeAccessCodePath("a b")).toBe(encodeURIComponent("A B"));
  });

  it("builds a guest session without retaining a guest name or attendance count", () => {
    const session = buildGuestSession(sampleEvent, "2026-07-01T00:00:00.000Z");
    expect(session).not.toHaveProperty("guestName");
    expect(session).not.toHaveProperty("attendanceCount");
    expect(session.guestAccessCode).toBe("AYALA-TECH-YALA");
    expect(session.openedAt).toBe("2026-07-01T00:00:00.000Z");
  });

  it("resolves post-open path safely", () => {
    expect(resolvePostOpenPath("/dashboard")).toBe("/dashboard");
    expect(resolvePostOpenPath("https://evil.example")).toBe("/dashboard");
    expect(resolvePostOpenPath(null)).toBe("/dashboard");
  });
});
