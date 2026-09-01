import { UrgentIssueStatus, type UrgentIssueStatus as UrgentIssueStatusValue } from '@prism/kernel/event-core';

const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  UrgentIssueStatus.Resolved,
  UrgentIssueStatus.Cancelled,
]);

/**
 * An urgent issue opens as Assigned when an owner is already known at
 * creation time, otherwise it opens as Open (unassigned).
 */
export function resolveUrgentIssueStatusOnCreate(input: {
  ownerRole?: string;
  ownerName?: string;
}): UrgentIssueStatusValue {
  return input.ownerRole || input.ownerName ? UrgentIssueStatus.Assigned : UrgentIssueStatus.Open;
}

export function isTerminalUrgentIssueStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}
