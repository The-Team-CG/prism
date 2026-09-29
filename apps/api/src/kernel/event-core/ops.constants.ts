export const OpsUserRole = {
  PmcmAdmin: 'pmcm-admin',
  Client: 'client',
  Coordinator: 'coordinator',
  Supplier: 'supplier',
  Guest: 'guest',
  System: 'system',
  Unknown: 'unknown',
} as const;

export const InquiryStatus = {
  New: 'new',
  Accepted: 'accepted',
  Pending: 'pending',
  Declined: 'declined',
} as const;

export const SupplierTier = {
  Tier1: 'tier_1',
  Tier2: 'tier_2',
  PendingFirstEvent: 'pending_first_event',
} as const;

export const SupplierQuoteRequestStatus = {
  Open: 'open',
  Submitted: 'submitted',
  RevisionRequested: 'revision_requested',
  Revised: 'revised',
  Selected: 'selected',
  Closed: 'closed',
  Expired: 'expired',
} as const;

export const SupplierQuoteStatus = {
  Received: 'received',
  Revised: 'revised',
  Selected: 'selected',
  NotSelected: 'not_selected',
  Locked: 'locked',
} as const;

export const CoordinatorAssignmentStatus = {
  PendingAcknowledgement: 'pending_acknowledgement',
  Acknowledged: 'acknowledged',
  Declined: 'declined',
  Cancelled: 'cancelled',
  Replaced: 'replaced',
} as const;

/**
 * Assignment states that no longer occupy a coordinator on the event date.
 * Booking, availability and coverage checks treat every other state as active,
 * so any workflow that releases a coordinator must write one of these.
 */
export const INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES = [
  CoordinatorAssignmentStatus.Cancelled,
  CoordinatorAssignmentStatus.Replaced,
] as const;

export const EventDayTaskStatus = {
  Open: 'open',
  InProgress: 'in_progress',
  Done: 'done',
  Blocked: 'blocked',
} as const;

export const UrgentIssueStatus = {
  Open: 'open',
  Assigned: 'assigned',
  Resolved: 'resolved',
  Cancelled: 'cancelled',
} as const;

export const UrgentIssueSeverity = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
} as const;

export const CoordinatorAttendanceStatus = {
  Pending: 'pending',
  Present: 'present',
  Late: 'late',
  Absent: 'absent',
  Replaced: 'replaced',
} as const;

export const SupplierVerificationStatus = {
  SelfReported: 'self_reported',
  Verified: 'verified',
  Disputed: 'disputed',
} as const;

export const LiveOpsSlaStatus = {
  OnTrack: 'on_track',
  DueSoon: 'due_soon',
  Overdue: 'overdue',
  Resolved: 'resolved',
} as const;

export const LiveOpsEscalationLevel = {
  None: 'none',
  RoleLead: 'role_lead',
  Pmcm: 'pmcm',
  Critical: 'critical',
} as const;

export const AuditActionType = {
  General: 'general',
  Create: 'create',
  Update: 'update',
  Approve: 'approve',
  Decline: 'decline',
  Assign: 'assign',
  Upload: 'upload',
  Export: 'export',
  Login: 'login',
  LoginFailed: 'login_failed',
  ForbiddenAccess: 'forbidden_access',
  Archive: 'archive',
  Resolve: 'resolve',
} as const;

export const AuditCategory = {
  Events: 'events',
  Finance: 'finance',
  Suppliers: 'suppliers',
  Access: 'access',
  Documents: 'documents',
  Compliance: 'compliance',
} as const;

export const PortalInvitationStatus = {
  NotSent: 'not_sent',
  Sent: 'sent',
  Opened: 'opened',
  Expired: 'expired',
} as const;

export const NotificationChannel = {
  Email: 'email',
  Viber: 'viber',
} as const;

export const LoginHistoryStatus = {
  Success: 'success',
  Failed: 'failed',
  Locked: 'locked',
  Blocked: 'blocked',
} as const;

export const PrivacyRequestStatus = {
  Submitted: 'submitted',
  Approved: 'approved',
  Rejected: 'rejected',
  Executed: 'executed',
} as const;

export const PrivacyRequestType = {
  Access: 'access',
  Correction: 'correction',
  Deletion: 'deletion',
  Export: 'export',
} as const;

export type OpsUserRole = (typeof OpsUserRole)[keyof typeof OpsUserRole];
export type InquiryStatus = (typeof InquiryStatus)[keyof typeof InquiryStatus];
export type SupplierTier = (typeof SupplierTier)[keyof typeof SupplierTier];
export type SupplierQuoteRequestStatus =
  (typeof SupplierQuoteRequestStatus)[keyof typeof SupplierQuoteRequestStatus];
export type SupplierQuoteStatus = (typeof SupplierQuoteStatus)[keyof typeof SupplierQuoteStatus];
export type CoordinatorAssignmentStatus =
  (typeof CoordinatorAssignmentStatus)[keyof typeof CoordinatorAssignmentStatus];
export type EventDayTaskStatus = (typeof EventDayTaskStatus)[keyof typeof EventDayTaskStatus];
export type UrgentIssueStatus = (typeof UrgentIssueStatus)[keyof typeof UrgentIssueStatus];
export type UrgentIssueSeverity = (typeof UrgentIssueSeverity)[keyof typeof UrgentIssueSeverity];
export type CoordinatorAttendanceStatus =
  (typeof CoordinatorAttendanceStatus)[keyof typeof CoordinatorAttendanceStatus];
export type SupplierVerificationStatus = (typeof SupplierVerificationStatus)[keyof typeof SupplierVerificationStatus];
export type LiveOpsSlaStatus = (typeof LiveOpsSlaStatus)[keyof typeof LiveOpsSlaStatus];
export type LiveOpsEscalationLevel = (typeof LiveOpsEscalationLevel)[keyof typeof LiveOpsEscalationLevel];
export type AuditActionType = (typeof AuditActionType)[keyof typeof AuditActionType];
export type AuditCategory = (typeof AuditCategory)[keyof typeof AuditCategory];
export type PortalInvitationStatus =
  (typeof PortalInvitationStatus)[keyof typeof PortalInvitationStatus];
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];
export type LoginHistoryStatus = (typeof LoginHistoryStatus)[keyof typeof LoginHistoryStatus];
export type PrivacyRequestStatus = (typeof PrivacyRequestStatus)[keyof typeof PrivacyRequestStatus];
export type PrivacyRequestType = (typeof PrivacyRequestType)[keyof typeof PrivacyRequestType];

export function isOpsConstantValue<const T extends Record<string, string>>(
  values: T,
  candidate: string | null | undefined,
): candidate is T[keyof T] {
  return Boolean(candidate && (Object.values(values) as string[]).includes(candidate));
}
