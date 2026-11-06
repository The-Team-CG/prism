import { describe, expect, it } from "vitest";
import { wrapUpDeadline, wrapUpDeadlineCountdown } from "./wrap-up-deadline";

const ended = "2026-10-17T18:00:00.000Z";
const at = (iso: string) => wrapUpDeadlineCountdown(ended, new Date(iso));

describe("wrap-up deadline countdown", () => {
  it("closes 24 hours after the recorded actual end", () => {
    expect(wrapUpDeadline(ended)?.toISOString()).toBe("2026-10-18T18:00:00.000Z");
  });

  it("counts down in hours and minutes, calling the last six hours soon", () => {
    expect(at("2026-10-17T20:30:00.000Z")).toEqual({ label: "Due in 21h 30m", tone: "open" });
    expect(at("2026-10-18T12:00:00.000Z")).toEqual({ label: "Due in 6h", tone: "open" });
    expect(at("2026-10-18T12:01:00.000Z")).toEqual({ label: "Due in 5h 59m", tone: "soon" });
    expect(at("2026-10-18T17:18:00.000Z")).toEqual({ label: "Due in 42m", tone: "soon" });
  });

  it("reports how late it is once the deadline passes", () => {
    expect(at("2026-10-18T18:00:00.000Z")).toEqual({ label: "Due in 0m", tone: "soon" });
    expect(at("2026-10-18T20:05:00.000Z")).toEqual({ label: "Overdue by 2h 5m", tone: "overdue" });
  });

  it("has nothing to count before the event has ended or for an unreadable end", () => {
    expect(wrapUpDeadlineCountdown(null, new Date())).toBeNull();
    expect(wrapUpDeadlineCountdown("not a date", new Date())).toBeNull();
  });
});
