/** Pure live-ops domain rules (no React / I/O). */

export function liveOpsPillClass(value: string): string {
  if (
    ["done", "resolved", "verified", "present", "set_up_ready", "acknowledged", "confirmed", "on_track"].includes(
      value,
    )
  ) {
    return "bg-success-soft text-success ring-success/20";
  }
  if (
    ["late", "disputed", "blocked", "critical", "high", "absent", "overdue", "pmcm"].includes(value)
  ) {
    return "bg-danger-soft text-danger ring-danger/20";
  }
  if (
    ["in_progress", "assigned", "arrived", "medium", "self_reported", "due_soon", "role_lead"].includes(
      value,
    )
  ) {
    return "bg-attention-soft text-attention ring-attention/20";
  }
  return "bg-muted text-muted-foreground ring-border";
}

export function asIsoDateTime(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function computeLiveOpsMetrics(liveOps: {
  tasks?: Array<{ status: string }>;
  urgentIssues?: Array<{ status: string }>;
  supplierStatuses?: Array<{ eventDayVerificationStatus?: string; verificationStatus?: string }>;
  coordinatorAssignments?: Array<{ attendanceStatus?: string }>;
} | null) {
  const tasks = liveOps?.tasks ?? [];
  const issues = liveOps?.urgentIssues ?? [];
  const suppliers = liveOps?.supplierStatuses ?? [];
  const coordinators = liveOps?.coordinatorAssignments ?? [];
  return {
    completedTasks: tasks.filter((task) => task.status === "done").length,
    openIssues: issues.filter((issue) => !["resolved", "cancelled"].includes(issue.status)).length,
    verifiedSuppliers: suppliers.filter(
      (supplier) =>
        supplier.eventDayVerificationStatus === "verified" ||
        supplier.verificationStatus === "verified",
    ).length,
    presentCoordinators: coordinators.filter(
      (assignment) => assignment.attendanceStatus === "present",
    ).length,
  };
}

const ISSUE_SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function isOpenLiveOpsIssue(issue: { status: string }): boolean {
  return !["resolved", "cancelled"].includes(issue.status);
}

/** Desk order: open issues first, most severe first, then closed issues as history. */
export function orderLiveOpsIssuesForDesk<T extends { status: string; severity: string }>(issues: T[]): T[] {
  return [...issues].sort((a, b) => {
    const openDiff = Number(isOpenLiveOpsIssue(b)) - Number(isOpenLiveOpsIssue(a));
    if (openDiff !== 0) return openDiff;
    return (ISSUE_SEVERITY_RANK[a.severity] ?? 4) - (ISSUE_SEVERITY_RANK[b.severity] ?? 4);
  });
}
