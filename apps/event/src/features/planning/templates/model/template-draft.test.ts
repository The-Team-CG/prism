import { describe, expect, it } from "vitest";
import type { PrismPlanningTemplateItem } from "@prism/types";
import { draftFromItems, emptyItem, offsetLabel, offsetOf, slugKey, toTemplateItems, type DraftItem } from "./template-draft";

const row = (overrides: Partial<DraftItem> = {}): DraftItem => ({ ...emptyItem(), title: "Confirm the venue", ownerRole: "Operations", days: "60", ...overrides });

describe("template draft", () => {
  it("reads days before or after the event as a signed offset, and refuses anything that is not whole days in range", () => {
    expect(offsetOf({ days: "30", when: "before" })).toBe(-30);
    expect(offsetOf({ days: " 7 ", when: "after" })).toBe(7);
    expect(offsetOf({ days: "0", when: "before" })).toBe(0);
    for (const days of ["", "-5", "1.5", "abc", "731"]) expect(offsetOf({ days, when: "before" })).toBeNull();
    expect(offsetOf({ days: "366", when: "after" })).toBeNull();
    expect(offsetLabel(-30)).toBe("30 days before");
    expect(offsetLabel(-1)).toBe("1 day before");
    expect(offsetLabel(0)).toBe("On the event day");
    expect(offsetLabel(7)).toBe("7 days after");
  });

  it("makes stable keys from titles: lowercase words, starting with a letter, never reusing a taken key", () => {
    expect(slugKey("Confirm the venue!", new Set())).toBe("confirm-the-venue");
    expect(slugKey("2nd walkthrough", new Set())).toBe("task-2nd-walkthrough");
    expect(slugKey("  ", new Set())).toBe("task");
    expect(slugKey("Confirm the venue", new Set(["confirm-the-venue"]))).toBe("confirm-the-venue-2");
    expect(slugKey("Confirm the venue", new Set(["confirm-the-venue", "confirm-the-venue-2"]))).toBe("confirm-the-venue-3");
    expect(slugKey("x".repeat(80), new Set())).toHaveLength(36);
  });

  it("keeps the key of a task that was already published, so renaming it never creates a second task on reapply", () => {
    const published: PrismPlanningTemplateItem[] = [
      { key: "book-venue", title: "Book venue", ownerRole: "Operations", offsetDays: -90, dependsOn: null, notes: "" },
      { key: "send-invoice", title: "Send invoice", ownerRole: "Finance", offsetDays: -30, dependsOn: "book-venue", notes: "Use the template" },
    ];
    const draft = draftFromItems(published);
    expect(draft.map((entry) => [entry.key, entry.days, entry.when])).toEqual([["book-venue", "90", "before"], ["send-invoice", "30", "before"]]);
    expect(draft[1]!.dependsOn).toBe(draft[0]!.rowId);

    draft[0] = { ...draft[0]!, title: "Confirm the venue booking" };
    const result = toTemplateItems(draft);
    expect(result.problem).toBeNull();
    expect(result.items).toEqual([
      { key: "book-venue", title: "Confirm the venue booking", ownerRole: "Operations", offsetDays: -90, dependsOn: null, notes: "" },
      { key: "send-invoice", title: "Send invoice", ownerRole: "Finance", offsetDays: -30, dependsOn: "book-venue", notes: "Use the template" },
    ]);
  });

  it("keys new tasks from their titles and lets them wait for each other before either has a key", () => {
    const first = row({ title: "Book venue", days: "90" });
    const second = row({ title: "Book venue", days: "60", dependsOn: first.rowId });
    const result = toTemplateItems([first, second]);
    expect(result.items?.map((item) => [item.key, item.dependsOn])).toEqual([["book-venue", null], ["book-venue-2", "book-venue"]]);
  });

  it("names the task to fix, by its position, in plain words", () => {
    expect(toTemplateItems([row({ title: "  " })]).problem).toBe("Task 1: give it a title.");
    expect(toTemplateItems([row({ ownerRole: "" })]).problem).toBe("Task 1: say who owns it.");
    expect(toTemplateItems([row(), row({ days: "soon" })]).problem).toMatch(/^Task 2: days must be a whole number/);
    const early = row({ title: "Book venue", days: "90" });
    const waiting = row({ title: "Send invoice", days: "30", dependsOn: early.rowId });
    // A task may wait for one that falls earlier; it may not fall before the one it waits for.
    expect(toTemplateItems([early, waiting]).problem).toBeNull();
    const late = row({ title: "Final call", days: "10" });
    const dependent = row({ title: "Brief team", days: "40", dependsOn: late.rowId });
    expect(toTemplateItems([late, dependent]).problem).toBe("Task 2: is due before the task it waits for.");
  });

  it("refuses tasks that wait on each other in a loop", () => {
    const a = row({ title: "A", days: "30" });
    const b = row({ title: "B", days: "30", dependsOn: a.rowId });
    a.dependsOn = b.rowId;
    expect(toTemplateItems([a, b]).problem).toMatch(/loop/);
  });
});
