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
import type { EventOpsActorQuery } from "./primitives";

/** PMCM trust operations: the audit trail, privacy requests and legal holds, and data retention. */
export interface EventOpsTrustContract {
  audit: {
    integrity(actor?: EventOpsActorQuery): Promise<PrismAuditIntegrity>;
    /** Filters set to "all" or left empty are not sent. */
    logs(filters: AuditLogFilters, actor?: EventOpsActorQuery): Promise<PrismAuditLog[]>;
    exportLogs(filters: AuditLogFilters, actor?: EventOpsActorQuery): Promise<PrismAuditExport>;
    alerts(actor?: EventOpsActorQuery): Promise<PrismSecurityAlert[]>;
    loginHistory(userId: string, actor?: EventOpsActorQuery): Promise<PrismLoginHistory[]>;
    /** `eventId` of "all" or none covers every event. */
    privacyInventory(eventId?: string, actor?: EventOpsActorQuery): Promise<PrismPrivacyInventory>;
  };
  privacyAdmin: {
    requests(query?: Partial<ListPrivacyRequestsQueryInput>, actor?: EventOpsActorQuery): Promise<PrismPrivacyRequestPage>;
    createRequest(input: CreatePrivacyRequestInput, actor?: EventOpsActorQuery): Promise<PrismPrivacyRequest>;
    assignRequest(requestId: string, input: AssignPrivacyRequestInput, actor?: EventOpsActorQuery): Promise<PrismPrivacyRequest>;
    reviewRequest(requestId: string, input: ReviewPrivacyRequestInput, actor?: EventOpsActorQuery): Promise<PrismPrivacyRequest>;
    executeRequest(requestId: string, notes: string, correction?: PrivacyCorrectionPatch, actor?: EventOpsActorQuery): Promise<PrismPrivacyExecutionResult>;
    legalHolds(eventId?: string, actor?: EventOpsActorQuery): Promise<PrismPrivacyLegalHold[]>;
    createLegalHold(input: CreatePrivacyLegalHoldInput, actor?: EventOpsActorQuery): Promise<PrismPrivacyLegalHold>;
    releaseLegalHold(holdId: string, input: ReleasePrivacyLegalHoldInput, actor?: EventOpsActorQuery): Promise<PrismPrivacyLegalHold>;
    retentionPolicies(actor?: EventOpsActorQuery): Promise<PrismRetentionPolicy[]>;
    updateRetentionPolicy(category: string, input: UpdatePrivacyRetentionPolicyInput, actor?: EventOpsActorQuery): Promise<PrismRetentionPolicy>;
    retentionReviewItems(query: ListPrivacyRetentionReviewItemsQuery, actor?: EventOpsActorQuery): Promise<PrismRetentionReviewItem[]>;
    executeRetentionReviewItem(itemId: string, input: ExecutePrivacyRetentionReviewItemInput, actor?: EventOpsActorQuery): Promise<PrismRetentionExecutionResult>;
    dismissRetentionReviewItem(itemId: string, input: DismissPrivacyRetentionReviewItemInput, actor?: EventOpsActorQuery): Promise<PrismRetentionReviewItem>;
  };
}
