import { describe, expect, it } from "vitest";
import {
  formatShortDate,
  humanizeToken,
  isPaymentOverdue,
  liveOpsStatusTone,
} from "./event-ops-rules";

describe("event-ops-rules", () => {
  it("humanizes tokens", () => {
    expect(humanizeToken("ready_for_event_day")).toBe("ready for event day");
  });

  it("formats short dates and handles invalid", () => {
    expect(formatShortDate(null)).toBe("No date");
    expect(formatShortDate("not-a-date")).toBe("not-a-date");
    expect(formatShortDate("2026-08-15T00:00:00.000Z")).toMatch(/2026/);
  });

  it("detects overdue payments", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    expect(isPaymentOverdue("pending", "2026-07-01", now)).toBe(true);
    expect(isPaymentOverdue("paid", "2026-07-01", now)).toBe(false);
    expect(isPaymentOverdue("pending", "2026-08-01", now)).toBe(false);
  });

  it("maps live-ops status tones", () => {
    expect(liveOpsStatusTone("critical_block")).toBe("danger");
    expect(liveOpsStatusTone("pending_review")).toBe("warning");
    expect(liveOpsStatusTone("completed")).toBe("success");
    expect(liveOpsStatusTone("info")).toBe("neutral");
  });
});
