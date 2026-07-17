/** Pure floorplan workspace rules. */

export type FloorPlanDraftLike = {
  id: string;
  isActive?: boolean;
  status?: string;
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
