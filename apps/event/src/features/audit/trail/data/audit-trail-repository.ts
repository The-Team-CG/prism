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
  PrismSecurityAlert,
  PrismUser,
  ReviewPrivacyRequestInput,
} from "@prism/types";
import { prismApi } from "@/lib/prism-api";

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

export type AuditTrailCommands = Pick<
  typeof prismApi,
  | "approvalRequests"
  | "auditIntegrity"
  | "auditLogs"
  | "createPrivacyRequest"
  | "executePrivacyRequest"
  | "exportAuditLogs"
  | "loginHistory"
  | "pmcmState"
  | "privacyInventory"
  | "privacyRequests"
  | "privacyRetentionPolicies"
  | "reviewPrivacyRequest"
  | "securityAlerts"
>;

const auditTrailCommands = {
  approvalRequests: prismApi.approvalRequests,
  auditIntegrity: prismApi.auditIntegrity,
  auditLogs: prismApi.auditLogs,
  createPrivacyRequest: prismApi.createPrivacyRequest,
  executePrivacyRequest: prismApi.executePrivacyRequest,
  exportAuditLogs: prismApi.exportAuditLogs,
  loginHistory: prismApi.loginHistory,
  pmcmState: prismApi.pmcmState,
  privacyInventory: prismApi.privacyInventory,
  privacyRequests: prismApi.privacyRequests,
  privacyRetentionPolicies: prismApi.privacyRetentionPolicies,
  reviewPrivacyRequest: prismApi.reviewPrivacyRequest,
  securityAlerts: prismApi.securityAlerts,
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
