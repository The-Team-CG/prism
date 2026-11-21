import { describe, expect, it } from "vitest";
import type { PrismCoordinatorRoleView } from "@prism/types";
import { eventCountdown, eventPhase, formatCountdown, groupTasks, issueAreaOptions, issuesSummary, quickIssueTitle, runSheetNowAndNext, shiftNextUp, tasksSummary } from "./coordinator-shift";

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

describe("on site", () => {
  const segment = (overrides: Record<string, unknown>) => ({ id: "s", dayId: "d", sequence: 1, title: "Segment", plannedStartAt: "2026-11-20T10:00:00Z", plannedEndAt: "2026-11-20T11:00:00Z", ownerRole: "", location: "", status: "planned", actualStartedAt: null, actualEndedAt: null, startVarianceMinutes: null, endVarianceMinutes: null, ...overrides });
  const schedule = (segments: ReturnType<typeof segment>[]) => ({ eventId: "e", authored: true, serverTime: "", days: [{ id: "d", eventId: "e", dayDate: "2026-11-20", label: "Day 1", status: "active", segments }] });

  it("places the coordinator before, on or after the event day", () => {
    expect(eventPhase("2026-11-21", "2026-11-20")).toBe("before");
    expect(eventPhase("2026-11-20T00:00:00Z", "2026-11-20")).toBe("day");
    expect(eventPhase("2026-11-19", "2026-11-20")).toBe("after");
  });

  it("reads what is on from the live timer and what follows from the next planned segment", () => {
    const run = schedule([
      segment({ id: "dinner", title: "Dinner", plannedStartAt: "2026-11-20T11:00:00Z", status: "complete" }),
      segment({ id: "dance", title: "First dance", plannedStartAt: "2026-11-20T12:00:00Z", status: "active", location: "Main Hall" }),
      segment({ id: "toasts", title: "Toasts", plannedStartAt: "2026-11-20T12:30:00Z" }),
    ]);

    const live = runSheetNowAndNext(run as never, { status: "active", label: "", segmentId: "dance", secondsRemaining: 522, serverTime: "" });
    expect([live.now?.title, live.next?.title, live.secondsRemaining]).toEqual(["First dance", "Toasts", 522]);
    expect(runSheetNowAndNext(run as never, undefined).now?.title).toBe("First dance");
    expect(runSheetNowAndNext({ ...run, authored: false } as never, undefined)).toEqual({});
  });

  it("shows the countdown as minutes and seconds, with hours past an hour", () => {
    expect(formatCountdown(522)).toBe("8:42");
    expect(formatCountdown(3900)).toBe("1:05:00");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  it("leads a quick report's title with its kind, using the note or else the area", () => {
    expect(quickIssueTitle("Supplier", "Caterer 30 minutes late\nno word yet", "Kitchen")).toBe("Supplier: Caterer 30 minutes late");
    expect(quickIssueTitle("Equipment", "  ", "Stage")).toBe("Equipment issue · Stage");
    expect(quickIssueTitle("Other", "", "")).toBe("Other issue");
  });

  it("offers each place to report from once: run sheet locations, then earlier reports, then the venue", () => {
    const options = issueAreaOptions({
      schedule: schedule([segment({ location: "Main Hall" }), segment({ location: "Stage" }), segment({ location: "main hall" })]) as never,
      urgentIssues: [issue({ affectedArea: "Kitchen" }), issue({ affectedArea: "" })],
    }, "Garden Pavilion");

    expect(options).toEqual(["Main Hall", "Stage", "Kitchen", "Garden Pavilion"]);
  });
});

describe("page status lines", () => {
  it("counts open and blocked tasks, or says nothing is assigned", () => {
    expect(tasksSummary([task({ status: "open" }), task({ status: "blocked" }), task({ status: "done" })])).toBe("2 open · 1 blocked");
    expect(tasksSummary([task({ status: "done" })])).toBe("Nothing assigned to you right now");
  });

  it("counts open and overdue issues with the check-ins", () => {
    expect(issuesSummary([issue({ slaStatus: "overdue" }), issue({ status: "resolved" })], 1)).toBe("1 open · 1 overdue · 1 guest checked in");
    expect(issuesSummary([], 3)).toBe("No open issues · 3 guests checked in");
  });
});
