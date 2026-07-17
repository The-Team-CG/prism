import { describe, expect, it } from "vitest";
import {
  canApproveFloorPlanDraft,
  canSubmitFloorPlanDraft,
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
});
