import { describe, expect, it } from "vitest";
import {
  canApproveFloorPlanDraft,
  canReopenClientPreference,
  canSubmitFloorPlanDraft,
  canViewClientPreference,
  floorplanDraftActions,
  groupFloorplanDrafts,
  selectActiveDraft,
} from "./floorplan-workspace-rules";

describe("floorplan-workspace-rules", () => {
  it("selects active draft", () => {
    expect(
      selectActiveDraft([
        { id: "1", isActive: false },
        { id: "2", isActive: true },
      ])?.id,
    ).toBe("2");
  });

  it("gates submit/approve by status", () => {
    expect(canSubmitFloorPlanDraft("draft")).toBe(true);
    expect(canSubmitFloorPlanDraft("in_review")).toBe(false);
    expect(canSubmitFloorPlanDraft("approved")).toBe(false);
    expect(canApproveFloorPlanDraft("submitted")).toBe(true);
    expect(canApproveFloorPlanDraft("draft")).toBe(true);
    expect(canApproveFloorPlanDraft("approved")).toBe(false);
  });

  it("allows reopening only before an official plan is approved", () => {
    const preference = { sourceType: "client_preference", status: "client_submitted", createdByRole: "client" };

    expect(canReopenClientPreference(preference, "client_submitted", [])).toBe(true);
    expect(canReopenClientPreference(preference, "approved", [])).toBe(false);
    expect(
      canReopenClientPreference(preference, "in_review", [
        { isActive: true, status: "approved", sourceType: "blank" },
      ]),
    ).toBe(false);
    expect(canReopenClientPreference({ ...preference, status: "revision_requested" }, "revision_requested", [])).toBe(false);
  });

  it("allows PMCM to view a client preference after official approval when reopening is blocked", () => {
    const preference = { sourceType: "client_preference", status: "client_submitted", createdByRole: "client" };

    expect(canViewClientPreference(preference)).toBe(true);
    expect(canReopenClientPreference(preference, "approved", [])).toBe(false);
  });

  it("allows read-only viewing of legacy PMCM-approved preference layouts", () => {
    for (const createdByRole of ["pmcm-admin", "coordinator"]) {
      const legacyOfficial = { sourceType: "client_preference", status: "approved", createdByRole };

      expect(canViewClientPreference(legacyOfficial)).toBe(true);
      expect(canReopenClientPreference(legacyOfficial, "approved", [])).toBe(false);
    }

    expect(canViewClientPreference({
      sourceType: "client_preference",
      status: "approved",
      createdByRole: "client",
    })).toBe(false);
  });

  it("does not offer reopening for a PMCM-created preference row", () => {
    expect(
      canReopenClientPreference(
        { sourceType: "client_preference", status: "client_submitted", createdByRole: "pmcm-admin" },
        "client_submitted",
        [],
      ),
    ).toBe(false);
  });

  it("groups drafts so the active approved official plan leads, with preferences and history separate", () => {
    const groups = groupFloorplanDrafts([
      { id: "v1", sourceType: "template", status: "approved", isActive: false, approvedSnapshotAt: "2026-05-01T00:00:00.000Z" },
      { id: "v2", sourceType: "template", status: "approved", isActive: true, approvedSnapshotAt: "2026-04-01T00:00:00.000Z" },
      { id: "v3", sourceType: "template", status: "in_review", updatedAt: "2026-06-01T00:00:00.000Z" },
      { id: "pref", sourceType: "client_preference", status: "client_submitted", createdByRole: "client" },
    ]);
    expect(groups.official?.id).toBe("v2");
    expect(groups.history.map((draft) => draft.id)).toEqual(["v1"]);
    expect(groups.inProgress.map((draft) => draft.id)).toEqual(["v3"]);
    expect(groups.clientPreferences.map((draft) => draft.id)).toEqual(["pref"]);

    const fallback = groupFloorplanDrafts([
      { id: "old", sourceType: "template", status: "approved", approvedSnapshotAt: "2026-01-01T00:00:00.000Z" },
      { id: "new", sourceType: "template", status: "approved", approvedSnapshotAt: "2026-03-01T00:00:00.000Z" },
    ]);
    expect(fallback.official?.id).toBe("new");
    expect(groupFloorplanDrafts([{ id: "pref", sourceType: "client_preference", status: "approved" }]).official).toBeUndefined();
  });

  it("keeps client preferences out of PMCM edit, submit, and approve actions", () => {
    expect(floorplanDraftActions({ sourceType: "client_preference", status: "in_review", createdByRole: "client" }, null, [])).toMatchObject({ canEdit: false, canSubmit: false, canApprove: false });
    expect(floorplanDraftActions({ sourceType: "template", status: "revision_requested" }, null, [])).toMatchObject({ canEdit: true, canSubmit: true, canApprove: false });
    expect(floorplanDraftActions({ sourceType: "template", status: "in_review" }, null, [])).toMatchObject({ canSubmit: false, canApprove: true });
  });
});
