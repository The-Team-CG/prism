import type { PAREApprovalRecord } from "@prism/types";

export function selectEventPareApprovals<T extends Pick<PAREApprovalRecord, "eventId">>(
  approvals: T[],
  eventId: string,
): T[] {
  return approvals.filter((approval) => approval.eventId === eventId);
}
