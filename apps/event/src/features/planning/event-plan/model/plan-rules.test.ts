import { describe, expect, it } from "vitest";
import type { PrismEventPlanItem, PrismPlanPreview } from "@prism/types";
import { changeLabel, groupByTemplate, ownerLabel, planProgress, previewIsEmpty, previewSummary, toggledStatus } from "./plan-rules";

const item = (overrides: Partial<PrismEventPlanItem> = {}): PrismEventPlanItem => ({
  id: "plan_1", eventId: "evt_1", templateId: "ptpl_1", templateName: "Wedding", templateVersion: 1, key: "a", title: "Task a",
  ownerRole: "Account manager", ownerName: "", dueDate: "2026-11-20", status: "open", completedAt: null, completedBy: null, notes: "",
  dependsOn: null, dependsOnTitle: null, waiting: false, customized: false, overdue: false, ...overrides,
});

const preview = (overrides: Partial<PrismPlanPreview> = {}): PrismPlanPreview => ({
  eventId: "evt_1", templateId: "ptpl_1", templateName: "Wedding", version: 2, eventDate: "2026-12-20", previewToken: "token-123456",
  add: [], update: [], kept: [], removedFromTemplate: [], unchanged: 0, ...overrides,
});

describe("plan rules", () => {
  it("counts what is open, done, skipped and overdue", () => {
    expect(planProgress([])).toEqual({ total: 0, open: 0, done: 0, skipped: 0, overdue: 0 });
    expect(planProgress([item(), item({ overdue: true }), item({ status: "done" }), item({ status: "skipped" })])).toEqual({ total: 4, open: 2, done: 1, skipped: 1, overdue: 1 });
  });

  it("groups tasks by the template they came from, keeping each group in date order", () => {
    const groups = groupByTemplate([
      item({ id: "1", templateId: "ptpl_b", templateName: "Wedding", dueDate: "2026-10-01" }),
      item({ id: "2", templateId: "ptpl_a", templateName: "AV setup" }),
      item({ id: "3", templateId: "ptpl_b", templateName: "Wedding", dueDate: "2026-11-01" }),
    ]);
    expect(groups.map((group) => [group.templateName, group.items.map((entry) => entry.id)])).toEqual([["AV setup", ["2"]], ["Wedding", ["1", "3"]]]);
  });

  it("describes a change in words, reading dates as dates and an empty value as nothing", () => {
    expect(changeLabel({ field: "dueDate", from: "2026-11-20", to: "2026-11-05" })).toBe("Due: Nov 20, 2026 → Nov 5, 2026");
    expect(changeLabel({ field: "ownerRole", from: "Account manager", to: "Finance" })).toBe("Owner: Account manager → Finance");
    expect(changeLabel({ field: "dependsOn", from: "", to: "book-venue" })).toBe("Waits for: nothing → book-venue");
  });

  it("summarises a preview by what it would do, saying nothing about zero", () => {
    expect(previewSummary(preview())).toEqual([]);
    expect(previewIsEmpty(preview({ kept: [{ id: "1", key: "a", title: "A", reason: "done", changes: [] }] }))).toBe(true);
    const busy = preview({
      add: [{ key: "f", title: "F", ownerRole: "X", dueDate: "2026-12-01", pastDue: false }],
      update: [{ id: "1", key: "d", title: "D", changes: [] }, { id: "2", key: "g", title: "G", changes: [] }],
      kept: [{ id: "3", key: "a", title: "A", reason: "edited", changes: [] }],
      removedFromTemplate: [{ id: "4", key: "e", title: "E", status: "open" }],
      unchanged: 7,
    });
    expect(previewIsEmpty(busy)).toBe(false);
    expect(previewSummary(busy)).toEqual([
      "1 task to add",
      "2 tasks to update",
      "1 task kept as they are",
      "1 task no longer in the template, left on the plan",
      "7 tasks already match",
    ]);
  });

  it("moves an open task to done and anything else back to open, and names who a task is with", () => {
    expect(toggledStatus({ status: "open" })).toBe("done");
    expect(toggledStatus({ status: "done" })).toBe("open");
    expect(toggledStatus({ status: "skipped" })).toBe("open");
    expect(ownerLabel({ ownerName: "", ownerRole: "Finance" })).toBe("Finance");
    expect(ownerLabel({ ownerName: "Ana Reyes", ownerRole: "Finance" })).toBe("Ana Reyes (Finance)");
  });
});
