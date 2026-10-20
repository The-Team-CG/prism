/** Pure floorplan workspace rules. */

export type FloorPlanDraftLike = {
  id: string;
  isActive?: boolean;
  status?: string;
  sourceType?: string;
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

export function canReopenClientPreference(
  draft: Pick<FloorPlanDraftLike, "status" | "sourceType">,
  eventFloorPlanStatus: string | null | undefined,
  drafts: Array<Pick<FloorPlanDraftLike, "isActive" | "status" | "sourceType">>,
): boolean {
  if (draft.sourceType !== "client_preference" || draft.status !== "client_submitted") return false;
  if (eventFloorPlanStatus === "approved") return false;
  return !drafts.some(
    (candidate) =>
      candidate.isActive &&
      candidate.status === "approved" &&
      candidate.sourceType !== "client_preference",
  );
}
