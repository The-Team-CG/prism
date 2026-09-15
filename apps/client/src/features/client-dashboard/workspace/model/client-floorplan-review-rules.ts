import {
  createFloorPlanRevisionCommentSchema,
  parseContract,
  type CreateFloorPlanRevisionCommentInput,
  type PrismEvent,
  type PrismFloorPlanDraft,
} from "@prism/types";

export function buildFloorPlanRevisionPayload(revisionNote: string): CreateFloorPlanRevisionCommentInput {
  return parseContract(createFloorPlanRevisionCommentSchema, { revisionNote }, "Floorplan revision comment");
}

export function canRequestFloorPlanRevision(draft: PrismFloorPlanDraft | undefined, event: PrismEvent | undefined) {
  return Boolean(
    draft &&
      event &&
      draft.status === "in_review" &&
      event.clientPortalStatus === "unlocked" &&
      !event.archived,
  );
}

export function floorPlanRevisionComment(draft: PrismFloorPlanDraft | undefined) {
  return draft?.revisionComment?.trim() || null;
}

export function floorPlanReviewHeadline(draft: PrismFloorPlanDraft | undefined) {
  if (!draft) return "PMCM is working on the official floorplan.";
  if (draft.status === "revision_requested") return "Your revision comment was sent. PMCM will update the official plan.";
  if (draft.status === "approved") return "This official plan is approved and locked.";
  return "Review the official floorplan and request changes if needed.";
}

export function floorPlanRevisionSubmittedNote(draft: PrismFloorPlanDraft | undefined) {
  const comment = floorPlanRevisionComment(draft);
  return comment ? `You asked PMCM to revise the plan: "${comment}"` : null;
}