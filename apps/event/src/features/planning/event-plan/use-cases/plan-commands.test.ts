import { describe, expect, it, vi } from "vitest";
import type { PrismEventPlanItem, PrismPlanPreview } from "@prism/types";
import { draftFromTask, submitApply, submitPreview, submitStatus, submitTaskEdit } from "./plan-commands";

const task = (overrides: Partial<PrismEventPlanItem> = {}): PrismEventPlanItem => ({
  id: "plan_1", eventId: "evt_1", templateId: "ptpl_1", templateName: "Wedding", templateVersion: 1, key: "a", title: "Confirm venue",
  ownerRole: "Operations", ownerName: "", dueDate: "2026-11-20", status: "open", completedAt: null, completedBy: null, notes: "",
  dependsOn: null, dependsOnTitle: null, waiting: false, customized: false, overdue: false, ...overrides,
});

function createWriter() {
  return {
    preview: vi.fn(async () => ({}) as never),
    apply: vi.fn(async () => ({}) as never),
    updateItem: vi.fn(async () => task()),
  };
}

describe("plan commands", () => {
  it("previews the chosen template, and its current version when none is named", async () => {
    const writer = createWriter();
    await submitPreview(writer, "evt_1", "ptpl_1");
    await submitPreview(writer, "evt_1", "ptpl_1", 3);
    expect(writer.preview).toHaveBeenNthCalledWith(1, "evt_1", { templateId: "ptpl_1" });
    expect(writer.preview).toHaveBeenNthCalledWith(2, "evt_1", { templateId: "ptpl_1", version: 3 });
    await expect(submitPreview(writer, "evt_1", " ")).rejects.toThrow("Choose a template");
    expect(writer.preview).toHaveBeenCalledTimes(2);
  });

  it("applies exactly the preview that was shown, with its token", async () => {
    const writer = createWriter();
    const preview = { templateId: "ptpl_1", version: 2, previewToken: "token-123456" } as PrismPlanPreview;
    await submitApply(writer, "evt_1", preview);
    expect(writer.apply).toHaveBeenCalledWith("evt_1", { templateId: "ptpl_1", version: 2, previewToken: "token-123456" });
    await expect(submitApply(writer, "evt_1", { ...preview, previewToken: "short" })).rejects.toThrow(/Plan apply failed validation/);
    expect(writer.apply).toHaveBeenCalledTimes(1);
  });

  it("sends only the fields that changed, so an untouched field never pins the task", async () => {
    const writer = createWriter();
    const item = task();
    await submitTaskEdit(writer, "evt_1", item, { ...draftFromTask(item), ownerName: "Ana Reyes", dueDate: "2026-11-25" });
    expect(writer.updateItem).toHaveBeenCalledWith("evt_1", "plan_1", { ownerName: "Ana Reyes", dueDate: "2026-11-25" });
  });

  it("refuses an edit with nothing changed, a blank title or owner, or a date that does not exist", async () => {
    const writer = createWriter();
    const item = task();
    const same = draftFromTask(item);
    await expect(submitTaskEdit(writer, "evt_1", item, same)).rejects.toThrow("Nothing was changed");
    await expect(submitTaskEdit(writer, "evt_1", item, { ...same, title: "  " })).rejects.toThrow("needs a title");
    await expect(submitTaskEdit(writer, "evt_1", item, { ...same, ownerRole: "" })).rejects.toThrow("who owns");
    await expect(submitTaskEdit(writer, "evt_1", item, { ...same, dueDate: "2026-02-30" })).rejects.toThrow(/Plan task failed validation/);
    expect(writer.updateItem).not.toHaveBeenCalled();
  });

  it("changes a task's status on its own", async () => {
    const writer = createWriter();
    await submitStatus(writer, "evt_1", { id: "plan_1" }, "done");
    expect(writer.updateItem).toHaveBeenCalledWith("evt_1", "plan_1", { status: "done" });
  });
});
