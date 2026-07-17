/** Pure live-ops domain rules (no React / I/O). */

export function liveOpsPillClass(value: string): string {
  if (
    ["done", "resolved", "verified", "present", "set_up_ready", "acknowledged", "confirmed", "on_track"].includes(
      value,
    )
  ) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }
  if (
    ["late", "disputed", "blocked", "critical", "high", "absent", "overdue", "pmcm"].includes(value)
  ) {
    return "bg-rose-50 text-rose-700 ring-rose-100";
  }
  if (
    ["in_progress", "assigned", "arrived", "medium", "self_reported", "due_soon", "role_lead"].includes(
      value,
    )
  ) {
    return "bg-amber-50 text-amber-800 ring-amber-100";
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
