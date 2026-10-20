import type {
  AuditLogFilters,
  PrismApprovalRequest,
  PrismAuditExport,
  PrismAuditIntegrity,
  PrismAuditLog,
  PrismEvent,
  PrismLoginHistory,
  PrismPrivacyInventory,
  PrismPmcmDashboardWorkspace,
  PrismPrivacyRequestPage,
  PrismSecurityAlert,
  PrismUser,
} from "@prism/types";
import { eventApi, eventApiRequest } from "@/lib/prism-api";

export type AuditTrailData = {
  logs: PrismAuditLog[];
  alerts: PrismSecurityAlert[];
  loginHistory: PrismLoginHistory[];
  auditIntegrity: PrismAuditIntegrity;
  privacyInventory: PrismPrivacyInventory;
  approvalRequests: PrismApprovalRequest[];
  privacySubmittedCount: number;
};

export type AuditTrailCommands = {
  approvalRequests(): Promise<PrismApprovalRequest[]>;
  auditIntegrity(): Promise<PrismAuditIntegrity>;
  auditLogs(filters: AuditLogFilters): Promise<PrismAuditLog[]>;
  exportAuditLogs(filters: AuditLogFilters): Promise<PrismAuditExport>;
  loginHistory(userId: string): Promise<PrismLoginHistory[]>;
  pmcmState(): Promise<PrismPmcmDashboardWorkspace>;
  privacyInventory(eventId?: string): Promise<PrismPrivacyInventory>;
  privacyRequestQueue(eventId?: string): Promise<PrismPrivacyRequestPage>;
  securityAlerts(): Promise<PrismSecurityAlert[]>;
};

function eventScope(eventId?: string) {
  return eventId && eventId !== "all" ? `?eventId=${encodeURIComponent(eventId)}` : "";
}

const auditTrailCommands = {
  approvalRequests: () => eventApiRequest<PrismApprovalRequest[]>("/api/auth/approval-requests"),
  auditIntegrity: () => eventApiRequest<PrismAuditIntegrity>("/api/audit/integrity"),
  auditLogs: (filters: AuditLogFilters) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value);
    });
    const query = params.toString();
    return eventApiRequest<PrismAuditLog[]>(`/api/audit/logs${query ? `?${query}` : ""}`);
  },
  exportAuditLogs: (filters: AuditLogFilters) =>
    eventApiRequest<PrismAuditExport>("/api/audit/export", { method: "POST", body: filters }),
  loginHistory: (userId: string) => eventApiRequest<PrismLoginHistory[]>(`/api/auth/users/${userId}/login-history`),
  pmcmState: () => eventApi.pmcmDashboard.detail(),
  privacyInventory: (eventId?: string) => eventApiRequest<PrismPrivacyInventory>(`/api/privacy/inventory${eventScope(eventId)}`),
  // Only the total is used here; the privacy console owns the full paged queue.
  privacyRequestQueue: (eventId?: string) => {
    const params = new URLSearchParams({ status: "submitted", limit: "1" });
    if (eventId && eventId !== "all") params.set("eventId", eventId);
    return eventApiRequest<PrismPrivacyRequestPage>(`/api/privacy/requests?${params.toString()}`);
  },
  securityAlerts: () => eventApiRequest<PrismSecurityAlert[]>("/api/audit/alerts"),
} satisfies AuditTrailCommands;

export function createAuditTrailRepository(commands: AuditTrailCommands = auditTrailCommands) {
  return {
    loadContext(): Promise<{ events: PrismEvent[]; users: PrismUser[] }> {
      return commands.pmcmState().then(({ events, users }) => ({ events, users }));
    },

    load(filters: AuditLogFilters, userId: string, eventId: string): Promise<AuditTrailData> {
      return Promise.all([
        commands.auditLogs(filters),
        commands.securityAlerts(),
        commands.loginHistory(userId),
        commands.auditIntegrity(),
        commands.privacyInventory(eventId),
        commands.approvalRequests(),
        commands.privacyRequestQueue(eventId),
      ]).then(([logs, alerts, loginHistory, auditIntegrity, privacyInventory, approvalRequests, privacyQueue]) => ({
        logs,
        alerts,
        loginHistory,
        auditIntegrity,
        privacyInventory,
        approvalRequests,
        privacySubmittedCount: privacyQueue.total,
      }));
    },

    export(filters: AuditLogFilters): Promise<PrismAuditExport> {
      return commands.exportAuditLogs(filters);
    },
  };
}

export type AuditTrailRepository = ReturnType<typeof createAuditTrailRepository>;
