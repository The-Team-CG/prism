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
