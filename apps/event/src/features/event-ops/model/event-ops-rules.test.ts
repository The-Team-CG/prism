import { describe, expect, it } from "vitest";
import { formatShortDate, humanizeToken } from "./event-ops-rules";

describe("event-ops-rules", () => {
  it("humanizes tokens", () => {
    expect(humanizeToken("ready_for_event_day")).toBe("ready for event day");
  });

  it("formats short dates and handles invalid", () => {
    expect(formatShortDate(null)).toBe("No date");
    expect(formatShortDate("not-a-date")).toBe("not-a-date");
    expect(formatShortDate("2026-08-15T00:00:00.000Z")).toMatch(/2026/);
  });
});
