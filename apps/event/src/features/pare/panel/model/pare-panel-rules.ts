import type { PAREApprovalRecord, PARERisk } from "@prism/types";

export function selectEventPareApprovals<T extends Pick<PAREApprovalRecord, "eventId">>(
  approvals: T[],
  eventId: string,
): T[] {
  return approvals.filter((approval) => approval.eventId === eventId);
}

const RISK_COLOR: Record<string, string> = {
  HIGH: "text-red-600 bg-red-50 border-red-200",
  MEDIUM: "text-amber-600 bg-amber-50 border-amber-200",
  LOW: "text-green-700 bg-green-50 border-green-200",
};

export function pareRiskColor(level: PARERisk["level"] | string) {
  return RISK_COLOR[level] ?? RISK_COLOR.LOW;
}

export function pareModeCopy(mode: string) {
  if (mode === "live") {
    return { label: "Claude AI", className: "bg-purple-50 text-purple-700 border-purple-200" };
  }
  return { label: "Mock", className: "bg-gray-100 text-gray-500 border-gray-200" };
}

export function pareBudgetTone(feasible: boolean) {
  if (feasible) {
    return {
      box: "border-green-200 bg-green-50",
      icon: "text-green-700",
      title: "text-green-800",
      label: "Within Budget",
    };
  }
  return {
    box: "border-red-200 bg-red-50",
    icon: "text-red-600",
    title: "text-red-800",
    label: "Over Budget",
  };
}

export function pareReviewSummary(record: { status: string; reviewedBy?: string | null; reviewedAt?: string | null }) {
  const verdict = record.status === "approved" ? "Approved" : "Rejected";
  const by = record.reviewedBy ? ` by ${record.reviewedBy}` : "";
  const at = record.reviewedAt ? ` · ${new Date(record.reviewedAt).toLocaleString()}` : "";
  return `${verdict}${by}${at}`;
}

export function formatPareTier(tier?: string | null) {
  return tier?.replace("tier_", "Tier ") ?? null;
}

export function pareResultCountLabel(count: number) {
  return `PARE Results · ${count} record${count !== 1 ? "s" : ""}`;
}
