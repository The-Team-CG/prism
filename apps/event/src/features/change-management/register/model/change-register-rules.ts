import type { PrismEventFreezeException } from "@prism/types";

export function isScopeFrozen(freezeStatus: string | null | undefined): boolean {
  return freezeStatus === "frozen";
}

export function pendingFreezeExceptions(exceptions: readonly PrismEventFreezeException[]): PrismEventFreezeException[] {
  return exceptions.filter((exception) => exception.status === "pending");
}

export function freezeExceptionStatusLabel(status: PrismEventFreezeException["status"]): string {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Awaiting decision";
}
