import { describe, expect, it } from "vitest";
import type { PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { coordinatorAssignmentHistory } from "./coordinator-assignment-history";

const assignment = (overrides: Partial<PrismCoordinatorAssignment>): PrismCoordinatorAssignment => ({
  id: "a", eventId: "e", coordinatorName: "Marco Santos", role: "General Coordinator", status: "acknowledged", doubleBookingWarning: false, ...overrides,
});
const event = (id: string, eventName: string, eventDate: string) => ({ id, eventName, eventDate }) as PrismEvent;

const TODAY = "2026-11-20";

describe("coordinatorAssignmentHistory", () => {
  it("splits what is ahead from what is past, soonest and newest first, and names each event", () => {
    const history = coordinatorAssignmentHistory(
      [
        assignment({ id: "next", eventId: "e2", eventDate: "2026-12-05", status: "assigned" }),
        assignment({ id: "today", eventId: "e1", eventDate: "2026-11-20" }),
        assignment({ id: "old", eventId: "e0", eventDate: "2025-03-01", attendanceStatus: "present" }),
        assignment({ id: "recent", eventId: "e9", eventDate: "2026-06-01", attendanceStatus: "late" }),
      ],
      [event("e1", "Ayala Wedding", "2026-11-20"), event("e2", "Summit", "2026-12-05"), event("e0", "Gala", "2025-03-01")],
      TODAY,
    );

    expect(history.upcoming.map((row) => [row.eventName, row.outcome])).toEqual([["Ayala Wedding", "Confirmed"], ["Summit", "Needs your confirmation"]]);
    expect(history.past.map((year) => year.year)).toEqual(["2026", "2025"]);
    expect(history.past[0].rows[0].eventName).toBe("Event on Jun 1, 2026");
    expect(history.past[0].rows[0].outcome).toBe("Late arrival");
    expect(history.past[1].rows[0].outcome).toBe("Present");
  });

  it("adds up the record from past events the coordinator actually worked", () => {
    const { record, past } = coordinatorAssignmentHistory(
      [
        assignment({ id: "p", eventDate: "2026-01-01", attendanceStatus: "present" }),
        assignment({ id: "l", eventDate: "2026-02-01", attendanceStatus: "late" }),
        assignment({ id: "x", eventDate: "2026-03-01", attendanceStatus: "absent" }),
        assignment({ id: "r", eventDate: "2026-04-01", status: "replaced", attendanceStatus: "replaced", replacementReason: "Sick" }),
        assignment({ id: "w", eventDate: "2026-05-01", withdrawnAt: "2026-04-28", withdrawalReason: "Family emergency" }),
        assignment({ id: "u", eventDate: "2026-12-01" }),
      ],
      [],
      TODAY,
    );

    expect(record).toEqual({ worked: 3, present: 1, late: 1, absent: 1, upcoming: 1 });
    const outcomes = Object.fromEntries(past[0].rows.map((row) => [row.assignment.id, row.outcome]));
    expect(outcomes).toMatchObject({ r: "Replaced", w: "Withdrew", x: "Absent" });
  });

  it("files an assignment with no date under Undated", () => {
    const { past } = coordinatorAssignmentHistory([assignment({ id: "nodate" })], [], TODAY);
    expect(past).toEqual([{ year: "Undated", rows: [expect.objectContaining({ eventName: "Event", outcome: "Attendance not recorded" })] }]);
  });
});
