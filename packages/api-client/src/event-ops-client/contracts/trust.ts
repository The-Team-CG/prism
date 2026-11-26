import type {
  AssignPrivacyRequestInput,
  AuditLogFilters,
  CreatePrivacyLegalHoldInput,
  CreatePrivacyRequestInput,
  DismissPrivacyRetentionReviewItemInput,
  ExecutePrivacyRetentionReviewItemInput,
  ListPrivacyRequestsQueryInput,
  ListPrivacyRetentionReviewItemsQuery,
  PrismAuditExport,
  PrismAuditIntegrity,
  PrismAuditLog,
  PrismLoginHistory,
  PrismPrivacyExecutionResult,
  PrismPrivacyInventory,
  PrismPrivacyLegalHold,
  PrismPrivacyRequest,
  PrismPrivacyRequestPage,
  PrismRetentionExecutionResult,
  PrismRetentionPolicy,
  PrismRetentionReviewItem,
  PrismSecurityAlert,
  PrivacyCorrectionPatch,
  ReleasePrivacyLegalHoldInput,
  ReviewPrivacyRequestInput,
  UpdatePrivacyRetentionPolicyInput,
} from "@prism/types";

/** PMCM trust operations: the audit trail, privacy requests and legal holds, and data retention. */
export interface EventOpsTrustContract {
  audit: {
    requestNotificationAcknowledgment(deliveryId: string, input: import('@prism/types').RequestNotificationAcknowledgmentInput): Promise<{ id: string; acknowledgmentDueAt: string }>;
    refreshNotificationOutcome(notificationId: string, deliveryId: string): Promise<{ id: string; providerOutcome: string }>;
    notificationDeliveries(notificationId: string): Promise<import("@prism/types").PrismNotificationRecipientDelivery[]>;
    retryNotification(notificationId: string, input: import("@prism/types").RetryNotificationInput): Promise<{ id: string; status: "queued" }>;
    integrity(): Promise<PrismAuditIntegrity>;
    /** Filters set to "all" or left empty are not sent. */
    logs(filters: AuditLogFilters): Promise<PrismAuditLog[]>;
    exportLogs(filters: AuditLogFilters): Promise<PrismAuditExport>;
    alerts(): Promise<PrismSecurityAlert[]>;
    loginHistory(userId: string): Promise<PrismLoginHistory[]>;
    /** `eventId` of "all" or none covers every event. */
    privacyInventory(eventId?: string): Promise<PrismPrivacyInventory>;
  };
  privacyAdmin: {
    requests(query?: Partial<ListPrivacyRequestsQueryInput>): Promise<PrismPrivacyRequestPage>;
    createRequest(input: CreatePrivacyRequestInput): Promise<PrismPrivacyRequest>;
    assignRequest(requestId: string, input: AssignPrivacyRequestInput): Promise<PrismPrivacyRequest>;
    reviewRequest(requestId: string, input: ReviewPrivacyRequestInput): Promise<PrismPrivacyRequest>;
    executeRequest(requestId: string, notes: string, correction?: PrivacyCorrectionPatch): Promise<PrismPrivacyExecutionResult>;
    legalHolds(eventId?: string): Promise<PrismPrivacyLegalHold[]>;
    createLegalHold(input: CreatePrivacyLegalHoldInput): Promise<PrismPrivacyLegalHold>;
    releaseLegalHold(holdId: string, input: ReleasePrivacyLegalHoldInput): Promise<PrismPrivacyLegalHold>;
    retentionPolicies(): Promise<PrismRetentionPolicy[]>;
    updateRetentionPolicy(category: string, input: UpdatePrivacyRetentionPolicyInput): Promise<PrismRetentionPolicy>;
    retentionReviewItems(query: ListPrivacyRetentionReviewItemsQuery): Promise<PrismRetentionReviewItem[]>;
    executeRetentionReviewItem(itemId: string, input: ExecutePrivacyRetentionReviewItemInput): Promise<PrismRetentionExecutionResult>;
    dismissRetentionReviewItem(itemId: string, input: DismissPrivacyRetentionReviewItemInput): Promise<PrismRetentionReviewItem>;
  };
}
