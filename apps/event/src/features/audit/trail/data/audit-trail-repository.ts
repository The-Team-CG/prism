import type {
  AuditLogFilters,
  CreateAccountInvitationInput,
  PrismAccountInvitationOutcome,
  PrismApprovalRequest,
  PrismAuditExport,
  PrismAuditIntegrity,
  PrismAuditLog,
  PrismEvent,
  PrismIdentityAccountSummary,
  PrismLoginHistory,
  PrismPrivacyInventory,
  PrismPmcmReference,
  PrismPrivacyRequestPage,
  PrismSecurityAlert,
  PrismUser,
} from "@prism/types";
import { eventApi } from "@/lib/prism-api";
import { identityCommands } from "@/features/event-dashboard/shell/data/commands/identity-commands";

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
  pmcmReference(): Promise<PrismPmcmReference>;
  privacyInventory(eventId?: string): Promise<PrismPrivacyInventory>;
  privacyRequestQueue(eventId?: string): Promise<PrismPrivacyRequestPage>;
  securityAlerts(): Promise<PrismSecurityAlert[]>;
  unlockUser(userId: string): Promise<PrismIdentityAccountSummary>;
  resetUserTwoFactor(userId: string): Promise<PrismIdentityAccountSummary>;
  resendAccountInvitation(userId: string): Promise<PrismAccountInvitationOutcome>;
  inviteStaff(input: CreateAccountInvitationInput): Promise<PrismAccountInvitationOutcome>;
};

const auditTrailCommands = {
  approvalRequests: () => eventApi.auth.approvalRequests(),
  auditIntegrity: () => eventApi.audit.integrity(),
  auditLogs: (filters: AuditLogFilters) => eventApi.audit.logs(filters),
  exportAuditLogs: (filters: AuditLogFilters) => eventApi.audit.exportLogs(filters),
  loginHistory: (userId: string) => eventApi.audit.loginHistory(userId),
  pmcmReference: () => eventApi.pmcm.reference(),
  privacyInventory: (eventId?: string) => eventApi.audit.privacyInventory(eventId),
  // Only the total is used here; the privacy console owns the full paged queue.
  privacyRequestQueue: (eventId?: string) =>
    eventApi.privacyAdmin.requests({ status: "submitted", limit: 1, ...(eventId && eventId !== "all" ? { eventId } : {}) }),
  securityAlerts: () => eventApi.audit.alerts(),
  unlockUser: identityCommands.unlockUser,
  resetUserTwoFactor: identityCommands.resetUserTwoFactor,
  resendAccountInvitation: identityCommands.resendAccountInvitation,
  inviteStaff: identityCommands.inviteStaff,
} satisfies AuditTrailCommands;

export function createAuditTrailRepository(commands: AuditTrailCommands = auditTrailCommands) {
  return {
    loadContext(): Promise<{ events: PrismEvent[]; users: PrismUser[] }> {
      return commands.pmcmReference().then(({ events, users }) => ({ events, users }));
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

    unlockUser: (userId: string) => commands.unlockUser(userId),
    resetUserTwoFactor: (userId: string) => commands.resetUserTwoFactor(userId),
    resendAccountInvitation: (userId: string) => commands.resendAccountInvitation(userId),
    inviteStaff: (input: CreateAccountInvitationInput) => commands.inviteStaff(input),
  };
}

export type AuditTrailRepository = ReturnType<typeof createAuditTrailRepository>;
