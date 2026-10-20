/** Pure floorplan workspace rules. */

export type FloorPlanDraftLike = {
  id: string;
  isActive?: boolean;
  status?: string;
  sourceType?: string;
  createdByRole?: string;
};

export function selectActiveDraft<T extends FloorPlanDraftLike>(
  drafts: T[] | undefined | null,
): T | undefined {
  if (!drafts?.length) return undefined;
  return drafts.find((d) => d.isActive) ?? drafts[0];
}

export function canSubmitFloorPlanDraft(status?: string): boolean {
  if (!status) return true;
  return status !== "in_review" && status !== "approved";
}

export function canApproveFloorPlanDraft(status?: string): boolean {
  if (!status) return true;
  return status !== "approved";
}

export function canViewClientPreference(
  draft: Pick<FloorPlanDraftLike, "status" | "sourceType" | "createdByRole">,
): boolean {
  return draft.sourceType === "client_preference" &&
    draft.createdByRole === "client" &&
    (draft.status === "client_submitted" || draft.status === "revision_requested");
}

export function canReopenClientPreference(
  draft: Pick<FloorPlanDraftLike, "status" | "sourceType" | "createdByRole">,
  eventFloorPlanStatus: string | null | undefined,
  drafts: Array<Pick<FloorPlanDraftLike, "isActive" | "status" | "sourceType">>,
): boolean {
  if (draft.sourceType !== "client_preference" || draft.createdByRole !== "client" || draft.status !== "client_submitted") return false;
  if (eventFloorPlanStatus === "approved") return false;
  return !drafts.some(
    (candidate) =>
      candidate.isActive &&
      candidate.status === "approved" &&
      candidate.sourceType !== "client_preference",
  );
}
