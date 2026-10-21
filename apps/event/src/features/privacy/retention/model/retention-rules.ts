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

export function reviewStatusLabel(status: PrismRetentionReviewItem["status"]) {
  const labels: Record<PrismRetentionReviewItem["status"], string> = {
    pending: "Awaiting review",
    held: "Held by legal hold",
    executed: "Executed",
    dismissed: "Dismissed",
  };
  return labels[status];
}
