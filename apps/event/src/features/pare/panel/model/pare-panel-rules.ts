import { formatPortalDateTime } from "@prism/ui/format-date";
import type { PAREApprovalRecord, PARERisk } from "@prism/types";

export function selectEventPareApprovals<T extends Pick<PAREApprovalRecord, "eventId">>(
  approvals: T[],
  eventId: string,
): T[] {
  return approvals.filter((approval) => approval.eventId === eventId);
}

const RISK_COLOR: Record<string, string> = {
  HIGH: "text-danger bg-danger-soft border-danger/25",
  MEDIUM: "text-attention bg-attention-soft border-attention/25",
  LOW: "text-success bg-success-soft border-success/25",
};

export function pareRiskColor(level: PARERisk["level"] | string) {
  return RISK_COLOR[level] ?? RISK_COLOR.LOW;
}

export function pareModeCopy(mode: string) {
  if (mode === "live") {
    return { label: "Claude AI", className: "bg-info-soft text-info" };
  }
  return { label: "Mock", className: "bg-muted text-muted-foreground" };
}

export function pareBudgetTone(feasible: boolean) {
  if (feasible) {
    return {
      box: "border-success/25 bg-success-soft",
      icon: "text-success",
      title: "text-success",
      label: "Within Budget",
    };
  }
  return {
    box: "border-danger/25 bg-danger-soft",
    icon: "text-danger",
    title: "text-danger",
    label: "Over Budget",
  };
}

export function pareReviewSummary(record: { status: string; reviewedBy?: string | null; reviewedAt?: string | null }) {
  const verdict = record.status === "approved" ? "Approved" : "Rejected";
  const by = record.reviewedBy ? ` by ${record.reviewedBy}` : "";
  const at = record.reviewedAt ? ` · ${formatPortalDateTime(record.reviewedAt)}` : "";
  return `${verdict}${by}${at}`;
}

export function formatPareTier(tier?: string | null) {
  return tier?.replace("tier_", "Tier ") ?? null;
}

export function pareResultCountLabel(count: number) {
  return `PARE Results · ${count} record${count !== 1 ? "s" : ""}`;
}
