import { describe, expect, it } from "vitest";
import { isFloorplanEditorReadOnly, isLockedFloorplanDraft } from "./editor-access";

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
