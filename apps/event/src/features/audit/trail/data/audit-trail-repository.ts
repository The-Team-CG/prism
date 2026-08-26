import type {
  AuditLogFilters,
  CreatePrivacyRequestInput,
  PrismApprovalRequest,
  PrismAuditExport,
  PrismAuditIntegrity,
  PrismAuditLog,
  PrismLoginHistory,
  PrismPrivacyInventory,
  PrismPrivacyRequest,
  PrismPrivacyRetentionPolicy,
  PrismSecurityAlert,
  ReviewPrivacyRequestInput,
} from "@prism/types";
import type { EventOpsCommands } from "@/features/event-ops";

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

export function createAuditTrailRepository(commands: EventOpsCommands) {
  return {
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
