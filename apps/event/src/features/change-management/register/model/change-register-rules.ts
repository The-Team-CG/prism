import type { PrismEventFreezeException } from "@prism/types";

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
