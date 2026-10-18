import type {
  AuditLogFilters,
  CreatePrivacyLegalHoldInput,
  CreatePrivacyRequestInput,
  PrismApprovalRequest,
  PrismAuditExport,
  PrismAuditIntegrity,
  PrismAuditLog,
  PrismEvent,
  PrismLoginHistory,
  PrismPrivacyExecutionResult,
  PrismPrivacyInventory,
  PrivacyCorrectionPatch,
  PrismPrivacyLegalHold,
  PrismPrivacyRequest,
  PrismPrivacyRetentionPolicy,
  PrismPmcmDashboardWorkspace,
  PrismSecurityAlert,
  PrismUser,
  ReviewPrivacyRequestInput,
  ReleasePrivacyLegalHoldInput,
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
  privacyLegalHolds: PrismPrivacyLegalHold[];
};

export type AuditTrailCommands = {
  approvalRequests(): Promise<PrismApprovalRequest[]>;
  auditIntegrity(): Promise<PrismAuditIntegrity>;
  auditLogs(filters: AuditLogFilters): Promise<PrismAuditLog[]>;
  createLegalHold(input: CreatePrivacyLegalHoldInput): Promise<PrismPrivacyLegalHold>;
  createPrivacyRequest(input: CreatePrivacyRequestInput): Promise<PrismPrivacyRequest>;
  executePrivacyRequest(requestId: string, notes?: string, correction?: PrivacyCorrectionPatch): Promise<PrismPrivacyExecutionResult>;
  exportAuditLogs(filters: AuditLogFilters): Promise<PrismAuditExport>;
  loginHistory(userId: string): Promise<PrismLoginHistory[]>;
  pmcmState(): Promise<PrismPmcmDashboardWorkspace>;
  privacyInventory(eventId?: string): Promise<PrismPrivacyInventory>;
  privacyLegalHolds(eventId?: string): Promise<PrismPrivacyLegalHold[]>;
  privacyRequests(eventId?: string): Promise<PrismPrivacyRequest[]>;
  privacyRetentionPolicies(): Promise<PrismPrivacyRetentionPolicy[]>;
  reviewPrivacyRequest(requestId: string, input: ReviewPrivacyRequestInput): Promise<PrismPrivacyRequest>;
  releaseLegalHold(holdId: string, input: ReleasePrivacyLegalHoldInput): Promise<PrismPrivacyLegalHold>;
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
  createLegalHold: (input: CreatePrivacyLegalHoldInput) =>
    eventApiRequest<PrismPrivacyLegalHold>("/api/privacy/legal-holds", { method: "POST", body: input }),
  executePrivacyRequest: (requestId: string, notes?: string, correction?: PrivacyCorrectionPatch) =>
    eventApiRequest<PrismPrivacyExecutionResult>(`/api/privacy/requests/${requestId}/execute`, {
      method: "POST", body: { executionNotes: notes, ...(correction ? { correction } : {}) },
    }),
  exportAuditLogs: (filters: AuditLogFilters) =>
    eventApiRequest<PrismAuditExport>("/api/audit/export", { method: "POST", body: filters }),
  loginHistory: (userId: string) => eventApiRequest<PrismLoginHistory[]>(`/api/auth/users/${userId}/login-history`),
  pmcmState: () => eventApi.pmcmDashboard.detail(),
  privacyInventory: (eventId?: string) =>
    eventApiRequest<PrismPrivacyInventory>(
      `/api/privacy/inventory${eventId && eventId !== "all" ? `?eventId=${encodeURIComponent(eventId)}` : ""}`,
    ),
  privacyLegalHolds: (eventId?: string) =>
    eventApiRequest<PrismPrivacyLegalHold[]>(
      `/api/privacy/legal-holds${eventId && eventId !== "all" ? `?eventId=${encodeURIComponent(eventId)}` : ""}`,
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
  releaseLegalHold: (holdId: string, input: ReleasePrivacyLegalHoldInput) =>
    eventApiRequest<PrismPrivacyLegalHold>(`/api/privacy/legal-holds/${holdId}/release`, {
      method: "POST", body: input,
    }),
  securityAlerts: () => eventApiRequest<PrismSecurityAlert[]>("/api/audit/alerts"),
} satisfies AuditTrailCommands;

export function createAuditTrailRepository(commands: AuditTrailCommands = auditTrailCommands) {
  return {
    loadContext(): Promise<{ events: PrismEvent[]; users: PrismUser[] }> {
      return commands.pmcmState().then(({ events, users }) => ({ events, users }));
    },

    load(filters: AuditLogFilters, userId: string, eventId: string, includeLegalHolds = false): Promise<AuditTrailData> {
      return Promise.all([
        commands.auditLogs(filters),
        commands.securityAlerts(),
        commands.loginHistory(userId),
        commands.auditIntegrity(),
        commands.privacyInventory(eventId),
        commands.approvalRequests(),
        commands.privacyRetentionPolicies(),
        commands.privacyRequests(eventId),
        includeLegalHolds ? commands.privacyLegalHolds(eventId) : Promise.resolve([]),
      ]).then(([logs, alerts, loginHistory, auditIntegrity, privacyInventory, approvalRequests, privacyPolicies, privacyRequests, privacyLegalHolds]) => ({
        logs,
        alerts,
        loginHistory,
        auditIntegrity,
        privacyInventory,
        approvalRequests,
        privacyPolicies,
        privacyRequests,
        privacyLegalHolds,
      }));
    },

    export(filters: AuditLogFilters): Promise<PrismAuditExport> {
      return commands.exportAuditLogs(filters);
    },

    createPrivacyRequest(input: CreatePrivacyRequestInput): Promise<PrismPrivacyRequest> {
      return commands.createPrivacyRequest(input);
    },

    createLegalHold(input: CreatePrivacyLegalHoldInput): Promise<PrismPrivacyLegalHold> {
      return commands.createLegalHold(input);
    },

    reviewPrivacyRequest(requestId: string, input: ReviewPrivacyRequestInput): Promise<PrismPrivacyRequest> {
      return commands.reviewPrivacyRequest(requestId, input);
    },

    executePrivacyRequest(requestId: string, notes: string, correction?: PrivacyCorrectionPatch): Promise<PrismPrivacyExecutionResult> {
      return commands.executePrivacyRequest(requestId, notes, correction);
    },

    releaseLegalHold(holdId: string, input: ReleasePrivacyLegalHoldInput): Promise<PrismPrivacyLegalHold> {
      return commands.releaseLegalHold(holdId, input);
    },
  };
}

export type AuditTrailRepository = ReturnType<typeof createAuditTrailRepository>;
