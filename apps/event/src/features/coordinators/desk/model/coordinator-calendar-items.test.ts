import { describe, expect, it } from "vitest";
import type { PrismEventDayTask, PrismEventScheduleDay } from "@prism/types";
import { buildCoordinatorCalendarItems } from "./coordinator-calendar-items";

const events = [
  { id: "e1", eventName: "Gala", eventDate: "2026-11-20" },
  { id: "e2", eventName: "Fair", eventDate: "2026-11-05T00:00:00.000Z" },
];
const task = (id: string, dueAt: string | null, status = "open") => ({ id, title: `Task ${id}`, dueAt, status }) as unknown as PrismEventDayTask;
const day = (id: string, dayDate: string, label: string) => ({ id, dayDate, label }) as unknown as PrismEventScheduleDay;

describe("buildCoordinatorCalendarItems", () => {
  it("shows every assigned event day, and the open event's open deadlines and other schedule days", () => {
    const items = buildCoordinatorCalendarItems(events, {
      eventId: "e1",
      // 22:00Z on the 18th is 06:00 on the 19th in Manila.
      tasks: [task("t1", "2026-11-18T22:00:00.000Z"), task("done", "2026-11-18T22:00:00.000Z", "done"), task("undated", null)],
      days: [day("d1", "2026-11-20", "Main day"), day("d0", "2026-11-19", "Load-in")],
    });

    expect(items.map((item) => [item.date, item.startTime ?? null, item.kind, item.title, item.view])).toEqual([
      ["2026-11-05", null, "event", "Fair", "shift"],
      ["2026-11-19", null, "schedule_day", "Load-in", "run-sheet"],
      ["2026-11-19", "06:00", "task", "Task t1", "tasks"],
      ["2026-11-20", null, "event", "Gala", "shift"],
    ]);
  });

  it("has only event days when no event is open, and ignores a focus on an event that is not assigned", () => {
    expect(buildCoordinatorCalendarItems(events, null)).toHaveLength(2);
    expect(buildCoordinatorCalendarItems(events, { eventId: "other", tasks: [task("t1", "2026-11-18T22:00:00.000Z")], days: [] })).toHaveLength(2);
  });
});
