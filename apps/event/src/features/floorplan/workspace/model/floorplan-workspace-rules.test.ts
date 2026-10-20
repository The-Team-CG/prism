import { describe, expect, it } from "vitest";
import {
  canApproveFloorPlanDraft,
  canReopenClientPreference,
  canSubmitFloorPlanDraft,
  canViewClientPreference,
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

  it("does not offer reopening for a PMCM-created preference row", () => {
    expect(
      canReopenClientPreference(
        { sourceType: "client_preference", status: "client_submitted", createdByRole: "pmcm-admin" },
        "client_submitted",
        [],
      ),
    ).toBe(false);
  });
});
