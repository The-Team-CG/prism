import type { PrismUserRole } from "@prism/types";
import { isPmcmAdmin } from "@/app/lib/role-guards";

/** Submitted and approved drafts are immutable: the API refuses their saves, so the editor opens them read-only. */
export function isLockedFloorplanDraft(status: string): boolean {
  return status === "in_review" || status === "approved";
}

/** The editor opens read-only for anyone but PMCM, and for PMCM on a draft that is submitted or approved. */
export function isFloorplanEditorReadOnly(screenReadOnly: boolean, role: PrismUserRole): boolean {
  return screenReadOnly || !isPmcmAdmin(role);
}

const DRAFT_STATUS_LABELS: Readonly<Record<string, string>> = {
  client_submitted: "From the client",
  pmcm_draft: "Draft",
  in_review: "In review",
  revision_requested: "Revision requested",
  approved: "Approved",
};

/** The draft's status as the editor's title names it; a status the editor has no word for is left unnamed. */
export function draftStatusLabel(status: string): string | undefined {
  return DRAFT_STATUS_LABELS[status];
}
