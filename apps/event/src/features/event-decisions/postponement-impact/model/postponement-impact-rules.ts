import type { PrismEventDecision } from "@prism/types";

export interface EffectivePostponementSnapshot {
  snapshotDecision: PrismEventDecision;
  latestDecision: PrismEventDecision;
  dateNeedsConfirmation: boolean;
}

export function effectivePostponementSnapshot(
  decisions: PrismEventDecision[],
): EffectivePostponementSnapshot | null {
  const ordered = [...decisions].sort((left, right) =>
    left.decidedAt.localeCompare(right.decidedAt) || left.id.localeCompare(right.id),
  );
  const latestDecision = ordered[ordered.length - 1];
  if (!latestDecision || latestDecision.decision === "cancelled") return null;

  let snapshotDecision: PrismEventDecision | null = null;
  for (const decision of ordered) {
    const reschedule = decision.assignmentImpact.reschedule;
    if (reschedule) snapshotDecision = decision;

    // Later decisions that release the assignments invalidate the old snapshot.
    if (snapshotDecision && decision !== snapshotDecision) {
      const snapshotIds = new Set(snapshotDecision.assignmentImpact.reschedule?.assignmentIds ?? []);
      if (decision.assignmentImpact.releasedAssignmentIds.some((id) => snapshotIds.has(id))) {
        snapshotDecision = null;
      }
    }
  }

  if (!snapshotDecision) return null;
  return {
    snapshotDecision,
    latestDecision,
    dateNeedsConfirmation: latestDecision.decision === "date_to_be_confirmed",
  };
}

export function rescheduleDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}
