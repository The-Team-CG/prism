import type {
  AuditLogFilters,
  CreatePrivacyRequestInput,
  PrismApprovalRequest,
  PrismAuditExport,
  PrismAuditIntegrity,
  PrismAuditLog,
  PrismEvent,
  PrismLoginHistory,
  PrismPrivacyInventory,
  PrismPrivacyRequest,
  PrismPrivacyRetentionPolicy,
  PrismPmcmDashboardWorkspace,
  PrismSecurityAlert,
  PrismUser,
  ReviewPrivacyRequestInput,
} from "@prism/types";
import { eventApi, eventApiRequest } from "@/lib/prism-api";

export type AuditTrailData = {
  logs: PrismAuditLog[];
  alerts: PrismSecurityAlert[];
  loginHistory: PrismLoginHistory[];
  auditIntegrity: PrismAuditIntegrity;
  privacyInventory: PrismPrivacyInventory;
  approvalRequests: PrismApprovalRequest[];
  privacyPolicies: PrismPrivacyRetentionPolicy[];
  privacyRequests: PrismPrivacyRequest[];
};

export type AuditTrailCommands = {
  approvalRequests(): Promise<PrismApprovalRequest[]>;
  auditIntegrity(): Promise<PrismAuditIntegrity>;
  auditLogs(filters: AuditLogFilters): Promise<PrismAuditLog[]>;
  createPrivacyRequest(input: CreatePrivacyRequestInput): Promise<PrismPrivacyRequest>;
  executePrivacyRequest(requestId: string, notes?: string): Promise<PrismPrivacyRequest>;
  exportAuditLogs(filters: AuditLogFilters): Promise<PrismAuditExport>;
  loginHistory(userId: string): Promise<PrismLoginHistory[]>;
  pmcmState(): Promise<PrismPmcmDashboardWorkspace>;
  privacyInventory(eventId?: string): Promise<PrismPrivacyInventory>;
  privacyRequests(eventId?: string): Promise<PrismPrivacyRequest[]>;
  privacyRetentionPolicies(): Promise<PrismPrivacyRetentionPolicy[]>;
  reviewPrivacyRequest(requestId: string, input: ReviewPrivacyRequestInput): Promise<PrismPrivacyRequest>;
  securityAlerts(): Promise<PrismSecurityAlert[]>;
};

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
  createPrivacyRequest: (input: CreatePrivacyRequestInput) =>
    eventApiRequest<PrismPrivacyRequest>("/api/privacy/requests", { method: "POST", body: input }),
  executePrivacyRequest: (requestId: string, notes?: string) =>
    eventApiRequest<PrismPrivacyRequest>(`/api/privacy/requests/${requestId}/execute`, {
      method: "POST", body: { executionNotes: notes },
    }),
  exportAuditLogs: (filters: AuditLogFilters) =>
    eventApiRequest<PrismAuditExport>("/api/audit/export", { method: "POST", body: filters }),
  loginHistory: (userId: string) => eventApiRequest<PrismLoginHistory[]>(`/api/auth/users/${userId}/login-history`),
  pmcmState: () => eventApi.pmcmDashboard.detail(),
  privacyInventory: (eventId?: string) =>
    eventApiRequest<PrismPrivacyInventory>(
      `/api/privacy/inventory${eventId && eventId !== "all" ? `?eventId=${encodeURIComponent(eventId)}` : ""}`,
    ),
  privacyRequests: (eventId?: string) =>
    eventApiRequest<PrismPrivacyRequest[]>(
      `/api/privacy/requests${eventId && eventId !== "all" ? `?eventId=${encodeURIComponent(eventId)}` : ""}`,
    ),
  privacyRetentionPolicies: () => eventApiRequest<PrismPrivacyRetentionPolicy[]>("/api/privacy/retention-policies"),
  reviewPrivacyRequest: (requestId: string, input: ReviewPrivacyRequestInput) =>
    eventApiRequest<PrismPrivacyRequest>(`/api/privacy/requests/${requestId}/review`, {
      method: "PATCH", body: input,
    }),
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
        commands.privacyRetentionPolicies(),
        commands.privacyRequests(eventId),
      ]).then(([logs, alerts, loginHistory, auditIntegrity, privacyInventory, approvalRequests, privacyPolicies, privacyRequests]) => ({
        logs,
        alerts,
        loginHistory,
        auditIntegrity,
        privacyInventory,
        approvalRequests,
        privacyPolicies,
        privacyRequests,
      }));
    },

    export(filters: AuditLogFilters): Promise<PrismAuditExport> {
      return commands.exportAuditLogs(filters);
    },

    createPrivacyRequest(input: CreatePrivacyRequestInput): Promise<PrismPrivacyRequest> {
      return commands.createPrivacyRequest(input);
    },

    reviewPrivacyRequest(requestId: string, input: ReviewPrivacyRequestInput): Promise<PrismPrivacyRequest> {
      return commands.reviewPrivacyRequest(requestId, input);
    },

    executePrivacyRequest(requestId: string, notes: string): Promise<PrismPrivacyRequest> {
      return commands.executePrivacyRequest(requestId, notes);
    },
  };
}

export type AuditTrailRepository = ReturnType<typeof createAuditTrailRepository>;
