import type {
  PrismApprovalRequest,
  PrismAuditLog,
  PrismLoginHistory,
  PrismPrivacyInventorySurface,
  PrismSecurityAlert,
  PrismUser,
  PrismUserRole,
} from "@prism/types";

export type AuditTrailSummary = {
  userActionCount: number;
  systemActionCount: number;
  openAlertCount: number;
  failedLoginCount: number;
  approvalBacklog: number;
  privacyBacklog: number;
  privacyRecordCount: number;
  missingConsentCount: number;
  privacySurfaceCount: number;
  retentionNote: string;
};

type PrivacyInventorySummaryInput = {
  retentionNotes: string[];
  globalSurfaces: Array<Pick<PrismPrivacyInventorySurface, "recordCount" | "missingConsentCount">>;
  events: Array<{ surfaces: Array<Pick<PrismPrivacyInventorySurface, "recordCount" | "missingConsentCount">> }>;
};

export function summarizeAuditTrail({
  logs,
  alerts,
  loginHistory,
  approvalRequests,
  privacySubmittedCount,
  privacyInventory,
}: {
  logs: Array<Pick<PrismAuditLog, "actorRole">>;
  alerts: Array<Pick<PrismSecurityAlert, "status">>;
  loginHistory: Array<Pick<PrismLoginHistory, "status">>;
  approvalRequests: Array<Pick<PrismApprovalRequest, "status">>;
  privacySubmittedCount: number;
  privacyInventory: PrivacyInventorySummaryInput | null;
}): AuditTrailSummary {
  const privacySurfaces = [
    ...(privacyInventory?.globalSurfaces ?? []),
    ...(privacyInventory?.events ?? []).flatMap((event) => event.surfaces),
  ];

  return {
    userActionCount: logs.filter((log) => log.actorRole !== "system").length,
    systemActionCount: logs.filter((log) => log.actorRole === "system").length,
    openAlertCount: alerts.filter((alert) => alert.status === "open").length,
    failedLoginCount: loginHistory.filter((entry) => entry.status !== "success").length,
    approvalBacklog: approvalRequests.filter((request) => request.status === "pending").length,
    privacyBacklog: privacySubmittedCount,
    privacyRecordCount: privacySurfaces.reduce((total, surface) => total + surface.recordCount, 0),
    missingConsentCount: privacySurfaces.reduce((total, surface) => total + surface.missingConsentCount, 0),
    privacySurfaceCount: privacySurfaces.length,
    retentionNote: privacyInventory?.retentionNotes?.[0] ?? "Retention notes unavailable",
  };
}

export function auditIconKind(category: string, severity: string) {
  if (severity === "critical" || severity === "warning") return "alert";
  if (category === "access") return "access";
  if (category === "documents") return "documents";
  if (category === "finance") return "finance";
  if (category === "suppliers") return "suppliers";
  return "default";
}

export type AdminAccountActions = {
  unlockAccount: boolean;
  resetTwoFactor: boolean;
  resendInvitation: boolean;
};

export function canManageAccounts(viewerRole: PrismUserRole) {
  return viewerRole === "pmcm-admin";
}

export function isAccountLocked(user: Pick<PrismUser, "lockedUntil" | "permanentLockout">, now: Date) {
  return Boolean(user.permanentLockout) || Boolean(user.lockedUntil && new Date(user.lockedUntil) > now);
}

/** Mirrors the API: two-factor reset applies only to PMCM admin accounts, and a resend only to accounts not yet activated. */
export function adminAccountActionsFor(
  user: Pick<PrismUser, "role" | "approvalStatus" | "lockedUntil" | "permanentLockout">,
  viewerRole: PrismUserRole,
  now: Date,
): AdminAccountActions {
  const admin = canManageAccounts(viewerRole);
  return {
    unlockAccount: admin && isAccountLocked(user, now),
    resetTwoFactor: admin && user.role === "pmcm-admin",
    resendInvitation: admin && user.approvalStatus === "invited",
  };
}

export function auditIntegrityCopy(integrity: { valid: boolean; checkedCount: number; firstBrokenLogId?: string | null } | null) {
  if (!integrity) {
    return { valid: true, headline: "Valid", detail: "Not checked yet" };
  }
  const breakNote = integrity.firstBrokenLogId ? ` - first break ${integrity.firstBrokenLogId}` : "";
  return {
    valid: integrity.valid !== false,
    headline: integrity.valid === false ? "Broken" : "Valid",
    detail: `${integrity.checkedCount} rows checked${breakNote}`,
  };
}

/** A run of back-to-back audit rows with the same actor, action and affected record, shown as one row. */
export type AuditLogGroup = { log: PrismAuditLog; count: number; oldestAt: string };

/** Collapses consecutive repeats (e.g. scheduled compliance runs) so the log reads as distinct activity. */
export function groupRepeatedAuditLogs(logs: PrismAuditLog[]): AuditLogGroup[] {
  const groups: AuditLogGroup[] = [];
  for (const log of logs) {
    const previous = groups.at(-1);
    if (
      previous &&
      previous.log.actor === log.actor &&
      previous.log.action === log.action &&
      previous.log.category === log.category &&
      previous.log.severity === log.severity &&
      (previous.log.affectedLabel ?? "") === (log.affectedLabel ?? "")
    ) {
      previous.count += 1;
      previous.oldestAt = log.createdAt;
      continue;
    }
    groups.push({ log, count: 1, oldestAt: log.createdAt });
  }
  return groups;
}
