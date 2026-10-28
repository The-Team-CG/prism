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
  if (draft.sourceType !== "client_preference") return false;
  if (draft.createdByRole === "client") {
    return draft.status === "client_submitted" || draft.status === "revision_requested";
  }
  return (draft.createdByRole === "pmcm-admin" || draft.createdByRole === "coordinator") &&
    draft.status === "approved";
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

export type FloorPlanDraftForWorkspace = FloorPlanDraftLike & {
  sourceType?: string;
  approvedAt?: string;
  approvedSnapshotAt?: string;
  reviewedAt?: string;
  updatedAt?: string;
  createdAt?: string;
};

export type FloorplanWorkspaceGroups<T> = {
  /** The authoritative approved official plan, if one exists. */
  official: T | undefined;
  /** PMCM drafts that are not yet approved (draft, in review, revision requested). */
  inProgress: T[];
  /** Client layout preferences; never official. */
  clientPreferences: T[];
  /** Older approved official versions. */
  history: T[];
};

function approvalTime(draft: FloorPlanDraftForWorkspace): string {
  return draft.approvedSnapshotAt ?? draft.approvedAt ?? draft.reviewedAt ?? draft.updatedAt ?? draft.createdAt ?? "";
}

function recency(draft: FloorPlanDraftForWorkspace): string {
  return draft.updatedAt ?? draft.createdAt ?? "";
}

/**
 * Splits drafts so the workspace can lead with the authoritative plan. The current
 * official plan is the active approved PMCM draft, else the most recently approved one.
 */
export function groupFloorplanDrafts<T extends FloorPlanDraftForWorkspace>(drafts: T[]): FloorplanWorkspaceGroups<T> {
  const clientPreferences = drafts
    .filter((draft) => draft.sourceType === "client_preference")
    .sort((a, b) => recency(b).localeCompare(recency(a)));
  const officialDrafts = drafts.filter((draft) => draft.sourceType !== "client_preference");
  const approved = officialDrafts
    .filter((draft) => draft.status === "approved")
    .sort((a, b) => approvalTime(b).localeCompare(approvalTime(a)));
  const official = approved.find((draft) => draft.isActive) ?? approved[0];
  return {
    official,
    inProgress: officialDrafts
      .filter((draft) => draft.status !== "approved")
      .sort((a, b) => recency(b).localeCompare(recency(a))),
    clientPreferences,
    history: approved.filter((draft) => draft !== official),
  };
}

/** PMCM actions offered for one draft; client preferences are view/reopen only. */
export function floorplanDraftActions(
  draft: Pick<FloorPlanDraftLike, "status" | "sourceType" | "createdByRole">,
  eventFloorPlanStatus: string | null | undefined,
  drafts: Array<Pick<FloorPlanDraftLike, "isActive" | "status" | "sourceType">>,
) {
  const isClientPreference = draft.sourceType === "client_preference";
  return {
    canEdit: !isClientPreference,
    canSubmit: !isClientPreference && ["pmcm_draft", "revision_requested"].includes(draft.status ?? ""),
    canApprove: !isClientPreference && draft.status === "in_review",
    canViewPreference: canViewClientPreference(draft),
    canReopenPreference: canReopenClientPreference(draft, eventFloorPlanStatus, drafts),
  };
}
