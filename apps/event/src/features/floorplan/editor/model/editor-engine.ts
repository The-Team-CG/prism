import type { PrismUserRole } from "@prism/types";
import { isPmcmAdmin } from "@/app/lib/role-guards";

export type FloorplanEngine = "pascal" | "legacy";

/** The floor plan editor this deployment opens. Only the exact value "pascal" turns the Pascal editor on. */
export function floorplanEngine(value: string | undefined = process.env.NEXT_PUBLIC_PRISM_FLOORPLAN_ENGINE): FloorplanEngine {
  return value === "pascal" ? "pascal" : "legacy";
}

/** Submitted and approved drafts are immutable: the API refuses their saves, so the editor opens them read-only. */
export function isLockedFloorplanDraft(status: string): boolean {
  return status === "in_review" || status === "approved";
}

/** Both editors open read-only for anyone but PMCM, and for PMCM on a draft that is submitted or approved. */
export function isFloorplanEditorReadOnly(screenReadOnly: boolean, role: PrismUserRole): boolean {
  return screenReadOnly || !isPmcmAdmin(role);
}
