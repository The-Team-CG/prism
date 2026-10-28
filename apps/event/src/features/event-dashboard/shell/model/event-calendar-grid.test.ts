import { describe, expect, it } from "vitest";
import { buildCalendarMonthGrid, eventDateKey, shiftMonth, todayDateKey } from "./event-calendar-grid";

const october2026 = { year: 2026, month: 9 };

function dayCells(cells: ReturnType<typeof buildCalendarMonthGrid>) {
  return cells.filter((cell) => cell.kind === "day");
}

describe("buildCalendarMonthGrid", () => {
  it("lays out October 2026 as 31 real days with October 1 under Thursday", () => {
    const cells = buildCalendarMonthGrid(october2026, [], "2026-10-29");
    const days = dayCells(cells);

    expect(days).toHaveLength(31);
    expect(days.at(-1)).toMatchObject({ dateKey: "2026-10-31", day: 31 });
    // Sunday-first grid: Thursday is column index 4.
    expect(cells.findIndex((cell) => cell.kind === "day" && cell.day === 1) % 7).toBe(4);
    expect(cells.length % 7).toBe(0);
    expect(days.filter((cell) => cell.isToday).map((cell) => cell.dateKey)).toEqual(["2026-10-29"]);
  });

  it("marks events by full date so another month's same day number never marks October", () => {
    const cells = buildCalendarMonthGrid(october2026, [
      { id: "may-2027", eventDate: "2027-05-15" },
      { id: "oct-2026", eventDate: "2026-10-15" },
      { id: "oct-2025", eventDate: "2025-10-15" },
      { id: "bad", eventDate: "not a date" },
    ]);
    const marked = dayCells(cells).filter((cell) => cell.eventIds.length > 0);

    expect(marked.map((cell) => [cell.dateKey, cell.eventIds])).toEqual([["2026-10-15", ["oct-2026"]]]);
  });

  it("handles leap February and months that start on Sunday", () => {
    expect(dayCells(buildCalendarMonthGrid({ year: 2028, month: 1 }, []))).toHaveLength(29);
    // November 2026 starts on a Sunday: no leading blanks.
    expect(buildCalendarMonthGrid({ year: 2026, month: 10 }, [])[0]).toMatchObject({ kind: "day", day: 1 });
  });
});

describe("calendar date helpers", () => {
  it("navigates across year boundaries", () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });

  it("resolves timestamps to the Philippine calendar date", () => {
    expect(eventDateKey("2026-10-01")).toBe("2026-10-01");
    expect(eventDateKey("2026-09-30T18:00:00.000Z")).toBe("2026-10-01");
    expect(eventDateKey("")).toBeNull();
    expect(todayDateKey(new Date("2026-10-28T20:00:00.000Z"))).toBe("2026-10-29");
  });
});
