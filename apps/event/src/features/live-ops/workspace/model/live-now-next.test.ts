import { describe, expect, it } from "vitest";
import type { PrismEventSchedule } from "@prism/types";
import { liveNowNext } from "./live-now-next";

const segment = (id: string, title: string, start: string, end: string, status = "planned") => ({ id, title, plannedStartAt: start, plannedEndAt: end, status, location: "Hall A" });
const schedule = {
  authored: true,
  days: [{ segments: [
    segment("s2", "Dinner service", "2026-12-07T07:00:00.000Z", "2026-12-07T08:30:00.000Z"),
    segment("s1", "Opening remarks", "2026-12-07T06:00:00.000Z", "2026-12-07T06:30:00.000Z"),
    segment("s0", "Cancelled toast", "2026-12-07T06:40:00.000Z", "2026-12-07T06:50:00.000Z", "skipped"),
  ] }],
} as unknown as PrismEventSchedule;

describe("liveNowNext", () => {
  it("finds the segment on now and the next one, skipping skipped segments", () => {
    const run = liveNowNext(schedule, undefined, "2026-12-07T06:10:00.000Z");
    expect(run.now?.title).toBe("Opening remarks");
    expect(run.next?.title).toBe("Dinner service");
    expect(run.minutesToNext).toBe(50);
  });

  it("prefers the timer's segment, and has nothing without an authored schedule", () => {
    expect(liveNowNext(schedule, { segmentId: "s2" } as never, "2026-12-07T06:10:00.000Z").now?.title).toBe("Dinner service");
    expect(liveNowNext({ ...schedule, authored: false }, undefined, "2026-12-07T06:10:00.000Z")).toEqual({ now: null, next: null, minutesToNext: null });
  });
});
