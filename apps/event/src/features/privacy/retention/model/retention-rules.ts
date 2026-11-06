import type { PrismRetentionPolicy, PrismRetentionReviewItem } from "@prism/types";

/** Only pending items can be executed; a held item waits until its legal hold is released. */
export function canExecuteReviewItem(item: PrismRetentionReviewItem) {
  return item.status === "pending";
}

export function canDismissReviewItem(item: PrismRetentionReviewItem) {
  return item.status === "pending" || item.status === "held";
}

/** The API refuses to enable reference-only categories; the toggle is disabled to match. */
export function canEnablePolicy(policy: PrismRetentionPolicy) {
  return policy.sweepable;
}

/** Whole days within the API bounds (30 to 3650). Returns null when the draft is not a valid period. */
export function parsePeriodDays(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const days = Number(trimmed);
  return days >= 30 && days <= 3650 ? days : null;
}

/** Whole years read as years ("7 years"); other periods stay in days. */
export function formatRetentionDays(days: number): string {
  if (days >= 365 && days % 365 === 0) return days === 365 ? "1 year" : `${days / 365} years`;
  return days === 1 ? "1 day" : `${days} days`;
}

/** The policy's period copy from the API, with its leading day count shown in years when it is a whole number of years. */
export function retentionPeriodCopy(policy: Pick<PrismRetentionPolicy, "periodDays" | "retentionPeriod">): string {
  const dayCount = `${policy.periodDays} days`;
  if (!policy.retentionPeriod.startsWith(dayCount)) return policy.retentionPeriod;
  return `${formatRetentionDays(policy.periodDays)}${policy.retentionPeriod.slice(dayCount.length)}`;
}

export function reviewStatusLabel(status: PrismRetentionReviewItem["status"]) {
  const labels: Record<PrismRetentionReviewItem["status"], string> = {
    pending: "Awaiting review",
    held: "Held by legal hold",
    executed: "Executed",
    dismissed: "Dismissed",
  };
  return labels[status];
}
