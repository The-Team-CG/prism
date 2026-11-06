import { describe, expect, it } from "vitest";
import { addDays, clockLabel, layoutOverlaps, monthWeeks, periodTitle, shiftAnchor, spanOf, visibleRange, weekDateKeys } from "@prism/ui/calendar-views";

describe("calendar view navigation", () => {
  it("builds Sunday-first weeks and pads a month with its neighbouring days", () => {
    expect(weekDateKeys("2026-11-05")).toEqual(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]);
    const weeks = monthWeeks({ year: 2026, month: 10 });
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toBe("2026-11-01");
    expect(weeks[4][6]).toBe("2026-12-05");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("steps by the unit each view shows and titles the visible period", () => {
    expect(shiftAnchor("month", "2026-11-17", 1)).toBe("2026-12-01");
    expect(shiftAnchor("month", "2026-01-15", -1)).toBe("2025-12-01");
    expect(shiftAnchor("week", "2026-11-05", 1)).toBe("2026-11-12");
    expect(shiftAnchor("day", "2026-11-05", -1)).toBe("2026-11-04");
    expect(shiftAnchor("agenda", "2026-11-05", 1)).toBe("2026-12-05");

    expect(periodTitle("month", "2026-11-05")).toBe("November 2026");
    expect(periodTitle("week", "2026-11-29")).toBe("Nov – Dec 2026");
    expect(periodTitle("day", "2026-11-05")).toBe("Thursday, November 5, 2026");
    expect(periodTitle("agenda", "2026-11-05")).toBe("Nov – Dec 2026");
  });
});

describe("visibleRange", () => {
  it("reports the dates each view puts on screen, including a month grid's neighbouring days", () => {
    expect(visibleRange("month", "2026-11-17")).toEqual({ from: "2026-11-01", to: "2026-12-05" });
    expect(visibleRange("week", "2026-11-05")).toEqual({ from: "2026-11-01", to: "2026-11-07" });
    expect(visibleRange("day", "2026-11-05")).toEqual({ from: "2026-11-05", to: "2026-11-05" });
    expect(visibleRange("agenda", "2026-11-05")).toEqual({ from: "2026-11-05", to: "2026-12-04" });
  });
});

describe("timed items", () => {
  it("writes times the way the calendar shows them", () => {
    expect(clockLabel("10:00")).toBe("10am");
    expect(clockLabel("14:30")).toBe("2:30pm");
    expect(clockLabel("00:15")).toBe("12:15am");
    expect(clockLabel("12:00")).toBe("12pm");
  });

  it("gives an item without an end an hour, and leaves untimed items off the time grid", () => {
    expect(spanOf({ startTime: "09:00" })).toMatchObject({ start: 540, end: 600 });
    expect(spanOf({ startTime: "09:00", endTime: "09:05" })).toMatchObject({ start: 540, end: 555 });
    expect(spanOf({})).toBeNull();
  });

  it("places overlapping items side by side and lets later items reclaim the full width", () => {
    const placements = layoutOverlaps([
      { id: "a", start: 540, end: 660 },
      { id: "b", start: 600, end: 720 },
      { id: "c", start: 630, end: 690 },
      { id: "later", start: 780, end: 840 },
    ]);

    expect(placements.get("a")).toEqual({ column: 0, columns: 3 });
    expect(placements.get("b")).toEqual({ column: 1, columns: 3 });
    expect(placements.get("c")).toEqual({ column: 2, columns: 3 });
    expect(placements.get("later")).toEqual({ column: 0, columns: 1 });
  });
});
