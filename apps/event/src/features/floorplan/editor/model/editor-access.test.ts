import { describe, expect, it } from "vitest";
import { isFloorplanEditorReadOnly, isLockedFloorplanDraft, opensReadOnly } from "./editor-access";

describe("isLockedFloorplanDraft", () => {
  it("locks the drafts the API refuses to change: submitted and approved", () => {
    expect(["pmcm_draft", "revision_requested", "in_review", "approved"].map(isLockedFloorplanDraft)).toEqual([false, false, true, true]);
  });
});

describe("isFloorplanEditorReadOnly", () => {
  it("opens editable only for PMCM on a draft that is not locked", () => {
    expect(isFloorplanEditorReadOnly(false, "pmcm-admin")).toBe(false);
    expect(isFloorplanEditorReadOnly(true, "pmcm-admin")).toBe(true);
    expect(isFloorplanEditorReadOnly(false, "coordinator")).toBe(true);
  });
});

describe("opensReadOnly", () => {
  const draft = { requested: false, storedStatus: "pmcm_draft", screenStatus: "pmcm_draft", archived: false, frozen: false };

  it("reopens a draft submitted elsewhere read-only, whatever the screen last saw", () => {
    expect(opensReadOnly(draft)).toBe(false);
    expect(opensReadOnly({ ...draft, storedStatus: "in_review" })).toBe(true);
    expect(opensReadOnly({ ...draft, storedStatus: null, screenStatus: "approved" })).toBe(true);
  });

  it("opens read-only on an archived event or a frozen scope, which the API refuses to save", () => {
    expect(opensReadOnly({ ...draft, archived: true })).toBe(true);
    expect(opensReadOnly({ ...draft, frozen: true })).toBe(true);
  });
});
