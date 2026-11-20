import { describe, expect, it } from "vitest";
import type { PrismCoordinatorRoleView } from "@prism/types";
import { eventCountdown, groupTasks, shiftNextUp } from "./coordinator-shift";

type Task = PrismCoordinatorRoleView["tasks"][number];
type Issue = PrismCoordinatorRoleView["urgentIssues"][number];

const task = (overrides: Partial<Task>): Task => ({ id: "t", eventId: "e", title: "Task", assignedRole: "General Coordinator", ownerName: "", priority: "normal", status: "open", notes: "", createdAt: "", updatedAt: "", ...overrides });
const issue = (overrides: Partial<Issue>): Issue => ({ id: "i", eventId: "e", title: "Issue", description: "", severity: "high", status: "open", affectedArea: "", ownerRole: "", ownerName: "", resolution: "", openedBy: "", createdAt: "", updatedAt: "", ...overrides });

describe("eventCountdown", () => {
  it("reads the event day as Today and counts the days before it", () => {
    expect(eventCountdown("2026-11-20T00:00:00.000Z", "2026-11-20")).toEqual({ value: "Today", label: "Event day" });
    expect(eventCountdown("2026-11-21", "2026-11-20")).toEqual({ value: "1", label: "day to go" });
    expect(eventCountdown("2026-12-01", "2026-11-20")).toEqual({ value: "11", label: "days to go" });
  });

  it("shows no figure once the event is over or has no date", () => {
    expect(eventCountdown("2026-11-19", "2026-11-20")).toBeUndefined();
    expect(eventCountdown(undefined, "2026-11-20")).toBeUndefined();
  });
});

describe("groupTasks", () => {
  it("files each task by status, soonest due first, and leaves cancelled ones out", () => {
    const groups = groupTasks([
      task({ id: "late", dueAt: "2026-11-20T10:00:00Z" }),
      task({ id: "early", dueAt: "2026-11-20T08:00:00Z" }),
      task({ id: "undated" }),
      task({ id: "stuck", status: "blocked" }),
      task({ id: "gone", status: "cancelled" }),
      task({ id: "finished", status: "done" }),
    ]);

    expect(groups.open.map((item) => item.id)).toEqual(["early", "late", "undated"]);
    expect(groups.blocked.map((item) => item.id)).toEqual(["stuck"]);
    expect(groups.done.map((item) => item.id)).toEqual(["finished"]);
    expect(Object.values(groups).flat().some((item) => item.id === "gone")).toBe(false);
  });
});

describe("shiftNextUp", () => {
  it("puts open issues first, most serious first, then open tasks by deadline", () => {
    const items = shiftNextUp({
      urgentIssues: [issue({ id: "minor", severity: "low" }), issue({ id: "fixed", status: "resolved" }), issue({ id: "fire", severity: "critical" })],
      tasks: [task({ id: "later", dueAt: "2026-11-20T12:00:00Z" }), task({ id: "sooner", dueAt: "2026-11-20T09:00:00Z" }), task({ id: "done", status: "done" })],
    });

    expect(items.map((item) => item.id)).toEqual(["fire", "minor", "sooner", "later"]);
    expect(items[0].tone).toBe("urgent");
    expect(items[1].tone).toBe("attention");
  });

  it("marks a blocked task urgent and says why it is blocked", () => {
    const [item] = shiftNextUp({ urgentIssues: [], tasks: [task({ status: "blocked", blockedReason: "No power at the stage" })] });

    expect(item.tone).toBe("urgent");
    expect(item.detail).toBe("Blocked: No power at the stage");
  });

  it("keeps to the limit", () => {
    expect(shiftNextUp({ urgentIssues: [], tasks: Array.from({ length: 8 }, (_, index) => task({ id: `t${index}` })) }, 5)).toHaveLength(5);
  });
});
