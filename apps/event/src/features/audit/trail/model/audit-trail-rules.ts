import type {
  PrismApprovalRequest,
  PrismAuditLog,
  PrismLoginHistory,
  PrismPrivacyInventorySurface,
  PrismPrivacyRequest,
  PrismSecurityAlert,
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
  privacyRequests,
  privacyInventory,
}: {
  logs: Array<Pick<PrismAuditLog, "actorRole">>;
  alerts: Array<Pick<PrismSecurityAlert, "status">>;
  loginHistory: Array<Pick<PrismLoginHistory, "status">>;
  approvalRequests: Array<Pick<PrismApprovalRequest, "status">>;
  privacyRequests: Array<Pick<PrismPrivacyRequest, "status">>;
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
    privacyBacklog: privacyRequests.filter((request) => request.status === "submitted").length,
    privacyRecordCount: privacySurfaces.reduce((total, surface) => total + surface.recordCount, 0),
    missingConsentCount: privacySurfaces.reduce((total, surface) => total + surface.missingConsentCount, 0),
    privacySurfaceCount: privacySurfaces.length,
    retentionNote: privacyInventory?.retentionNotes?.[0] ?? "Sample retention notes unavailable",
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
