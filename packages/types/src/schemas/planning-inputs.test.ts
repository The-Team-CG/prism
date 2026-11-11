import { describe, expect, it } from "vitest";
import {
  createPlanningTemplateSchema,
  planningDueDate,
  planningEventDateKey,
  planningItemIssues,
  publishPlanningTemplateVersionSchema,
  updateEventPlanItemSchema,
} from "./planning-inputs";

const item = (key: string, overrides: Record<string, unknown> = {}) => ({
  key, title: `Task ${key}`, ownerRole: "Account manager", offsetDays: -30, dependsOn: null, notes: "", ...overrides,
});
const template = (items: unknown[]) => ({ name: "Wedding", description: "", items });

describe("planning template contract", () => {
  it("accepts tasks that wait for earlier tasks, however they are ordered in the list", () => {
    const parsed = createPlanningTemplateSchema.safeParse(template([
      item("send-invoice", { offsetDays: -14, dependsOn: "confirm-venue" }),
      item("confirm-venue", { offsetDays: -60 }),
      item("final-walkthrough", { offsetDays: -14, dependsOn: "send-invoice" }),
    ]));
    expect(parsed.success).toBe(true);
  });

  it("names the task whose reference to another task cannot work", () => {
    const issues = planningItemIssues([
      item("a"),
      item("a", { offsetDays: -10 }),
      item("self", { dependsOn: "self" }),
      item("ghost", { dependsOn: "nowhere" }),
      item("early", { offsetDays: -90, dependsOn: "a" }),
    ]);
    expect(issues).toEqual([
      { index: 1, field: "key", message: "Another task already uses this key" },
      { index: 2, field: "dependsOn", message: "A task cannot wait for itself" },
      { index: 3, field: "dependsOn", message: "Waits for a task that is not in this template" },
      { index: 4, field: "dependsOn", message: "Is due before the task it waits for" },
    ]);
  });

  it("refuses tasks that wait on each other in a loop, even when they fall on the same day", () => {
    const issues = planningItemIssues([
      item("a", { dependsOn: "c" }),
      item("b", { dependsOn: "a" }),
      item("c", { dependsOn: "b" }),
    ]);
    expect(issues.map((issue) => issue.index)).toEqual([0, 1, 2]);
    expect(issues.every((issue) => /loop/.test(issue.message))).toBe(true);
    expect(createPlanningTemplateSchema.safeParse(template([item("a", { dependsOn: "b" }), item("b", { dependsOn: "a" })])).success).toBe(false);
  });

  it("carries tasks, dates and owners only: amounts and payment milestones are refused, not ignored", () => {
    for (const extra of [{ amount: 50000 }, { milestone: "Deposit" }, { paymentMilestone: { label: "Deposit" } }]) {
      expect(createPlanningTemplateSchema.safeParse(template([item("a", extra)])).success).toBe(false);
    }
    expect(publishPlanningTemplateVersionSchema.safeParse({ changeNote: "", items: [item("a")], amount: 1 }).success).toBe(false);
  });

  it("bounds the list, the keys and the offsets", () => {
    expect(createPlanningTemplateSchema.safeParse(template([])).success).toBe(false);
    expect(createPlanningTemplateSchema.safeParse(template([item("Has Capitals")])).success).toBe(false);
    expect(createPlanningTemplateSchema.safeParse(template([item("a", { offsetDays: -731 })])).success).toBe(false);
    expect(createPlanningTemplateSchema.safeParse(template([item("a", { offsetDays: 366 })])).success).toBe(false);
    expect(createPlanningTemplateSchema.safeParse(template([item("a", { offsetDays: 1.5 })])).success).toBe(false);
    expect(createPlanningTemplateSchema.safeParse(template([item("a", { ownerRole: "  " })])).success).toBe(false);
    expect(createPlanningTemplateSchema.safeParse(template(Array.from({ length: 201 }, (_, index) => item(`t${index}`)))).success).toBe(false);
  });

  it("asks for one change at least when editing a task, and only real dates", () => {
    expect(updateEventPlanItemSchema.safeParse({}).success).toBe(false);
    expect(updateEventPlanItemSchema.safeParse({ status: "done" }).success).toBe(true);
    expect(updateEventPlanItemSchema.safeParse({ dueDate: "2026-02-30" }).success).toBe(false);
    expect(updateEventPlanItemSchema.safeParse({ dueDate: "30 Nov" }).success).toBe(false);
    expect(updateEventPlanItemSchema.safeParse({ status: "cancelled" }).success).toBe(false);
  });
});

describe("planning dates", () => {
  it("counts days from the event date across month, year and leap-day boundaries", () => {
    expect(planningDueDate("2026-12-20", -30)).toBe("2026-11-20");
    expect(planningDueDate("2027-01-10", -14)).toBe("2026-12-27");
    expect(planningDueDate("2028-03-01", -1)).toBe("2028-02-29");
    expect(planningDueDate("2026-12-20", 7)).toBe("2026-12-27");
    expect(planningDueDate("2026-12-20", 0)).toBe("2026-12-20");
  });

  it("reads the event day the way PMCM does, in Philippine time", () => {
    // Stored as the day at UTC midnight, and as a late-evening instant that is already the next day in Manila.
    expect(planningEventDateKey("2026-12-20T00:00:00.000Z")).toBe("2026-12-20");
    expect(planningEventDateKey("2026-12-19T18:00:00.000Z")).toBe("2026-12-20");
  });
});
