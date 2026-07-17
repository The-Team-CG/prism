import { describe, expect, it } from "vitest";
import type { PrismGuestEventPass } from "@prism/types";
import {
  buildEventInfoQrUrl,
  buildEventInfoRows,
  decodeAccessCodeParam,
} from "./guest-event-info-rules";

const sampleEvent = {
  eventName: "Yala Tech Night",
  eventDate: "2026-08-01",
  clientName: "Ayala",
  guestAccessCode: "AYALA-TECH-YALA",
  readiness: "ready_for_event_day",
  floorPlanStatus: "approved",
  attendanceCount: 3,
} as PrismGuestEventPass;

describe("guest-event-info-rules", () => {
  it("decodes access code path param", () => {
    expect(decodeAccessCodeParam(encodeURIComponent("A/B"))).toBe("A/B");
  });

  it("builds guest-safe info rows without internal ids", () => {
    const rows = buildEventInfoRows(sampleEvent);
    expect(rows.map((r) => r.label)).toEqual([
      "Event",
      "Date",
      "Client",
      "Readiness",
      "Floorplan",
    ]);
    expect(rows.find((r) => r.label === "Readiness")?.value).toBe("ready for event day");
    expect(rows.some((r) => r.label.toLowerCase().includes("id"))).toBe(false);
  });

  it("builds self-referencing QR URL", () => {
    expect(buildEventInfoQrUrl("http://localhost:3003/", "CODE-1")).toBe(
      "http://localhost:3003/info/CODE-1",
    );
  });
});
