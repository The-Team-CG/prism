import { describe, expect, it } from "vitest";
import type { PrismDateChangeImpact, PrismPlanPreview } from "@prism/types";
import { canSyncPlan, conflictedSuppliers, impactHeadline, movingTasks, owedPayments, shiftLabel, syncableTemplates } from "./impact-rules";

const preview = (overrides: Partial<PrismPlanPreview> = {}): PrismPlanPreview => ({
  eventId: "evt_1", templateId: "ptpl_1", templateName: "Wedding", version: 1, eventDate: "2026-12-23", previewToken: "token-123456",
  add: [], update: [], kept: [], removedFromTemplate: [], unchanged: 0, ...overrides,
});
const moving = (id: string, title: string, from: string, to: string) => ({ id, key: id, title, changes: [{ field: "dueDate" as const, from, to }] });

const impact = (overrides: Partial<PrismDateChangeImpact> = {}): PrismDateChangeImpact => ({
  eventId: "evt_1", eventName: "Gala", currentDate: "2026-12-09", newDate: null, shiftDays: null, planApplicable: true,
  plan: { templates: [], movable: 0, kept: 0 }, suppliers: [], payments: [], approvedWork: [], ...overrides,
});

describe("date impact rules", () => {
  it("offers to move the plan only when the event has the date and something needs moving", () => {
    const templates = [preview({ templateId: "a", update: [moving("1", "Book venue", "2026-09-01", "2026-09-15")] }), preview({ templateId: "b", unchanged: 3 })];
    const withWork = impact({ plan: { templates, movable: 1, kept: 0 } });

    expect(syncableTemplates(withWork).map((template) => template.templateId)).toEqual(["a"]);
    expect(canSyncPlan(withWork)).toBe(true);
    // A date that is only being considered cannot be applied: the event does not have it yet.
    expect(canSyncPlan({ ...withWork, planApplicable: false, newDate: "2027-01-06", shiftDays: 28 })).toBe(false);
    expect(canSyncPlan(impact({ plan: { templates: [preview({ unchanged: 3 })], movable: 0, kept: 0 } }))).toBe(false);
    expect(canSyncPlan(impact())).toBe(false);
  });

  it("lists the open tasks that would move, with where each moves from and to", () => {
    const result = impact({
      plan: {
        templates: [
          preview({ templateName: "Wedding", update: [moving("1", "Book venue", "2026-09-01", "2026-09-15")] }),
          preview({ templateName: "AV", update: [moving("2", "Test sound", "2026-12-01", "2026-12-15"), { id: "3", key: "x", title: "Retitled", changes: [{ field: "title", from: "A", to: "B" }] }] }),
        ],
        movable: 3,
        kept: 0,
      },
    });
    expect(movingTasks(result)).toEqual([
      { id: "1", title: "Book venue", templateName: "Wedding", from: "2026-09-01", to: "2026-09-15" },
      { id: "2", title: "Test sound", templateName: "AV", from: "2026-12-01", to: "2026-12-15" },
    ]);
  });

  it("says how far the date moves, and what is being looked at", () => {
    expect(shiftLabel(null)).toBe("");
    expect(shiftLabel(0)).toBe("the same day");
    expect(shiftLabel(1)).toBe("1 day later");
    expect(shiftLabel(14)).toBe("14 days later");
    expect(shiftLabel(-7)).toBe("7 days earlier");
    expect(impactHeadline(impact())).toBe("The date the event has now: Dec 9, 2026.");
    expect(impactHeadline(impact({ newDate: "2026-12-23", shiftDays: 14 }))).toBe("Dec 9, 2026 → Dec 23, 2026, 14 days later.");
  });

  it("separates bookings with a known conflict, and the payments that still owe money from the ones already paid", () => {
    const supplier = (requestId: string, conflicts: string[]) => ({ requestId, supplierId: requestId, supplierName: requestId, category: "Catering", assignmentStatus: "confirmed", conflicts });
    const payment = (milestoneId: string, state: "paid" | "partial" | "open") => ({ milestoneId, label: milestoneId, amount: 100, amountPaid: state === "open" ? 0 : 100, remaining: 0, dueDate: "2026-11-01", state, suggestedDueDate: null });
    const result = impact({ suppliers: [supplier("a", []), supplier("b", ["Marked unavailable on that date"])], payments: [payment("p1", "paid"), payment("p2", "partial"), payment("p3", "open")] });

    expect(conflictedSuppliers(result).map((entry) => entry.requestId)).toEqual(["b"]);
    expect(owedPayments(result).map((entry) => entry.milestoneId)).toEqual(["p2", "p3"]);
  });
});
