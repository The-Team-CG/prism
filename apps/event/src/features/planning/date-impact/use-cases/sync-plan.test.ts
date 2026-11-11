import { describe, expect, it, vi } from "vitest";
import type { PrismDateChangeImpact, PrismPlanPreview } from "@prism/types";
import { submitSyncPlan } from "./sync-plan";

const preview = (templateId: string, overrides: Partial<PrismPlanPreview> = {}): PrismPlanPreview => ({
  eventId: "evt_1", templateId, templateName: templateId, version: 2, eventDate: "2026-12-23", previewToken: `token-${templateId}-123456`,
  add: [], update: [], kept: [], removedFromTemplate: [], unchanged: 0, ...overrides,
});
const moving = { id: "1", key: "a", title: "Book venue", changes: [{ field: "dueDate" as const, from: "2026-09-01", to: "2026-09-15" }] };

const impact = (overrides: Partial<PrismDateChangeImpact> = {}): PrismDateChangeImpact => ({
  eventId: "evt_1", eventName: "Gala", currentDate: "2026-12-23", newDate: null, shiftDays: null, planApplicable: true,
  plan: { templates: [preview("a", { update: [moving] }), preview("b", { unchanged: 3 })], movable: 1, kept: 0 }, suppliers: [], payments: [], approvedWork: [], ...overrides,
});

describe("submitSyncPlan", () => {
  it("sends back only the previewed templates that have something to move, each with the token it was shown with", async () => {
    const writer = { syncPlan: vi.fn(async () => ({ added: 0, updated: 1, kept: 0, items: [] })) };
    await submitSyncPlan(writer, impact());
    expect(writer.syncPlan).toHaveBeenCalledWith("evt_1", { templates: [{ templateId: "a", version: 2, previewToken: "token-a-123456" }] });
  });

  it("sends nothing for a date the event does not have yet, or when the plan already follows the date", async () => {
    const writer = { syncPlan: vi.fn() };
    await expect(submitSyncPlan(writer, impact({ planApplicable: false, newDate: "2027-01-06", shiftDays: 14 }))).rejects.toThrow("Record the new date on the event first");
    await expect(submitSyncPlan(writer, impact({ plan: { templates: [preview("b", { unchanged: 3 })], movable: 0, kept: 0 } }))).rejects.toThrow("already follows the event date");
    expect(writer.syncPlan).not.toHaveBeenCalled();
  });
});
