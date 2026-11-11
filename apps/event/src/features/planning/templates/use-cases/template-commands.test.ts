import { describe, expect, it, vi } from "vitest";
import { emptyItem, type DraftItem, type TemplateDraft } from "../model/template-draft";
import { submitArchive, submitNewTemplate, submitNewVersion } from "./template-commands";

const template = { id: "ptpl_1" } as never;

function createWriter() {
  return {
    create: vi.fn(async () => template),
    publish: vi.fn(async () => template),
    archive: vi.fn(async () => template),
    restore: vi.fn(async () => template),
  };
}

const row = (overrides: Partial<DraftItem> = {}): DraftItem => ({ ...emptyItem(), title: "Book venue", ownerRole: "Operations", days: "90", ...overrides });
const draft = (overrides: Partial<TemplateDraft> = {}): TemplateDraft => ({ name: " Wedding ", description: "", changeNote: " Earlier call ", items: [row()], ...overrides });

describe("template commands", () => {
  it("creates a template from a draft: trimmed name, keyed tasks, signed day offsets, nothing else on the wire", async () => {
    const writer = createWriter();
    const second = row({ title: "Send invoice", days: "30", ownerRole: " Finance ", notes: " Use the template " });
    const first = row();
    second.dependsOn = first.rowId;

    await submitNewTemplate(writer, draft({ items: [first, second] }));

    expect(writer.create).toHaveBeenCalledWith({
      name: "Wedding",
      description: "",
      items: [
        { key: "book-venue", title: "Book venue", ownerRole: "Operations", offsetDays: -90, dependsOn: null, notes: "" },
        { key: "send-invoice", title: "Send invoice", ownerRole: "Finance", offsetDays: -30, dependsOn: "book-venue", notes: "Use the template" },
      ],
    });
  });

  it("publishes the next version with its change note, keeping the keys of tasks already published", async () => {
    const writer = createWriter();
    await submitNewVersion(writer, "ptpl_1", draft({ items: [row({ key: "book-venue", title: "Confirm the venue booking" })] }));
    expect(writer.publish).toHaveBeenCalledWith("ptpl_1", {
      changeNote: "Earlier call",
      items: [{ key: "book-venue", title: "Confirm the venue booking", ownerRole: "Operations", offsetDays: -90, dependsOn: null, notes: "" }],
    });
  });

  it("sends nothing when the name is missing or a task cannot be published", async () => {
    const writer = createWriter();
    await expect(submitNewTemplate(writer, draft({ name: "  " }))).rejects.toThrow("Name the template");
    await expect(submitNewTemplate(writer, draft({ items: [row({ title: "" })] }))).rejects.toThrow("Task 1: give it a title");
    await expect(submitNewVersion(writer, "ptpl_1", draft({ items: [row({ days: "soon" })] }))).rejects.toThrow("Task 1: days must be");
    await expect(submitNewVersion(writer, "ptpl_1", draft({ items: [] }))).rejects.toThrow(/Add at least one task/);
    expect(writer.create).not.toHaveBeenCalled();
    expect(writer.publish).not.toHaveBeenCalled();
  });

  it("archives or restores the template it is given", async () => {
    const writer = createWriter();
    await submitArchive(writer, "ptpl_1", true);
    await submitArchive(writer, "ptpl_2", false);
    expect(writer.archive).toHaveBeenCalledWith("ptpl_1");
    expect(writer.restore).toHaveBeenCalledWith("ptpl_2");
  });
});
