import type { PrismAddendum, PrismAddendumConformeExecution, PrismEventFreezeException } from "@prism/types";

/** Newest addendum conforme version per addendum; the API returns every version, including superseded ones. */
export function latestAddendumConformes(conformes: readonly PrismAddendumConformeExecution[]): Map<string, PrismAddendumConformeExecution> {
  const latest = new Map<string, PrismAddendumConformeExecution>();
  for (const conforme of conformes) {
    const current = latest.get(conforme.addendumId);
    if (!current || conforme.documentVersion > current.documentVersion) latest.set(conforme.addendumId, conforme);
  }
  return latest;
}

/** PMCM may issue (or replace an unsigned) version until the addendum is executed or anyone has signed. */
export function canIssueAddendumConforme(addendum: Pick<PrismAddendum, "status">, latest: PrismAddendumConformeExecution | undefined): boolean {
  if (addendum.status === "executed") return false;
  return !latest || latest.status === "superseded" || latest.signatures.length === 0;
}

export function nextAddendumConformeVersion(latest: PrismAddendumConformeExecution | undefined): number {
  return (latest?.documentVersion ?? 0) + 1;
}

export function canCountersignAddendumConforme(latest: PrismAddendumConformeExecution | undefined): boolean {
  return latest?.status === "awaiting_pmcm";
}

export function addendumConformeStatusLabel(addendum: Pick<PrismAddendum, "status">, latest: PrismAddendumConformeExecution | undefined): string {
  if (addendum.status === "executed") return "Executed: client acknowledged and PMCM countersigned";
  if (!latest || latest.status === "superseded") return "No conforme issued";
  if (latest.status === "awaiting_client") return `Version ${latest.documentVersion} awaiting client acknowledgement`;
  if (latest.status === "awaiting_pmcm") return `Version ${latest.documentVersion} acknowledged, awaiting PMCM countersignature`;
  return `Version ${latest.documentVersion} completed`;
}

export function isScopeFrozen(freezeStatus: string | null | undefined): boolean {
  return freezeStatus === "frozen";
}

export function pendingFreezeExceptions(exceptions: readonly PrismEventFreezeException[]): PrismEventFreezeException[] {
  return exceptions.filter((exception) => exception.status === "pending");
}

/** An approval can be spent once; only approved, unconsumed exceptions can back a scope-changing decision. */
export function unusedApprovedExceptions(exceptions: readonly PrismEventFreezeException[]): PrismEventFreezeException[] {
  return exceptions.filter((exception) => exception.status === "approved" && !exception.consumedAt);
}

export function freezeExceptionStatusLabel(exception: Pick<PrismEventFreezeException, "status" | "consumedAt">): string {
  if (exception.status === "approved") return exception.consumedAt ? "Approved and used" : "Approved, not yet used";
  if (exception.status === "rejected") return "Rejected";
  return "Awaiting decision";
}

export const decisionOptions = [
  { value: "cancelled", label: "Cancel event" },
  { value: "postponed", label: "Postpone to a new date" },
  { value: "date_to_be_confirmed", label: "Date to be confirmed" },
] as const;

export const depositTreatmentOptions = [
  { value: "retain", label: "Retain deposit" },
  { value: "credit", label: "Credit deposit to a new date" },
  { value: "waive", label: "Waive deposit" },
] as const;

export const supplierImpactOptions = [
  { value: "release_obligations", label: "Release supplier obligations" },
  { value: "preserve_obligations", label: "Preserve supplier obligations" },
] as const;
