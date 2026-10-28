import { formatPortalDate } from "@prism/ui/format-date";
import {
  type PrismEvent,
  type PrismFloorPlanDraft,
} from "@prism/types";
import { selectClientFloorPlanDraft } from "./client-dashboard-selectors";
import { draftIsOfficial } from "./client-dashboard-view-rules";

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
/** The official plan the client should see first: approved, or submitted to them for review. */
export function clientVisibleOfficialPlan(draft: PrismFloorPlanDraft | undefined): PrismFloorPlanDraft | undefined {
  return draft && ["approved", "in_review", "revision_requested"].includes(draft.status) ? draft : undefined;
}

/**
 * What the client floorplan page shows: the authoritative plan first, then a separate card for the client's
 * own layout preference. Without a visible official plan, the preference card falls back to the latest draft.
 */
export function selectClientFloorPlanLayout(officialDraft: PrismFloorPlanDraft | undefined, preferenceDrafts: PrismFloorPlanDraft[]) {
  const officialPlan = clientVisibleOfficialPlan(officialDraft && draftIsOfficial(officialDraft) ? officialDraft : undefined);
  const activeDraft = officialPlan ? preferenceDrafts[0] : selectClientFloorPlanDraft(officialDraft, preferenceDrafts);
  const isOfficial = activeDraft !== undefined && draftIsOfficial(activeDraft);
  const draftApproved = isOfficial && activeDraft?.status === "approved";
  return {
    officialPlan,
    activeDraft,
    isOfficial,
    draftApproved,
    approved: officialPlan?.status === "approved" || draftApproved,
    showReview: officialPlan !== undefined && officialPlan.status !== "revision_requested",
    showPreferenceCard: !officialPlan || activeDraft !== undefined,
  };
}

/** Where the official plan stands and when, e.g. "Approved 3 Oct 2026". */
export function officialPlanStatusLine(draft: PrismFloorPlanDraft): string {
  if (draft.status === "approved") return `Approved ${formatPortalDate(draft.approvedAt ?? draft.reviewedAt ?? draft.updatedAt)}`;
  if (draft.status === "revision_requested") return `You asked for changes ${formatPortalDate(draft.reviewedAt ?? draft.updatedAt)}. PMCM is revising it.`;
  return `Sent for your review ${formatPortalDate(draft.submittedAt ?? draft.updatedAt)}`;
}
