export interface PrismAuditLog {
  id: string;
  eventId?: string;
  actor: string;
  actorRole: string;
  actorEmail?: string;
  action: string;
  actionType: string;
  category: string;
  affectedType?: string;
  affectedId?: string;
  affectedLabel?: string;
  metadata?: unknown;
  ipAddress: string;
  device: string;
  severity: string;
  immutableHash: string;
  previousHash?: string;
  createdAt: string;
}

export interface PrismLoginHistory {
  id: string;
  userId?: string;
  userName: string;
  userRole: string;
  email: string;
  status: string;
  ipAddress: string;
  device: string;
  failureReason?: string;
  createdAt: string;
}

export interface PrismSecurityAlert {
  id: string;
  eventId?: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  triggeredBy: string;
  metadata?: unknown;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface PrismAuditIntegrity {
  valid: boolean;
  checkedCount: number;
  firstBrokenLogId?: string | null;
  lastVerifiedHash?: string | null;
  checkedAt: string;
}

export interface PrismPrivacyInventorySurface {
  surface: string;
  recordCount: number;
  dataCategories: string[];
  consentAcceptedCount: number;
  missingConsentCount: number;
  privacyNoticeVersions: string[];
}

export interface PrismPrivacyInventoryEvent {
  eventId: string;
  eventName: string;
  dataCategories: string[];
  recordCount: number;
  surfaces: PrismPrivacyInventorySurface[];
  retentionNotes: string;
}

export interface PrismPrivacyInventory {
  generatedAt: string;
  events: PrismPrivacyInventoryEvent[];
  globalSurfaces: PrismPrivacyInventorySurface[];
  retentionNotes: string[];
}

export interface PrismPrivacyRetentionPolicy {
  surface: string;
  dataCategories: string[];
  retentionPeriod: string;
  deletionBehavior: string;
}

export interface PrismPrivacyRequest {
  id: string;
  eventId?: string | null;
  subjectType: string;
  subjectEmail: string;
  subjectName: string;
  requestType: "access" | "correction" | "deletion" | "export" | string;
  status: "submitted" | "approved" | "rejected" | "executed" | string;
  requestNotes: string;
  reviewReason: string;
  executionNotes: string;
  createdBy: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  executedBy?: string | null;
  executedAt?: string | null;
  /** SLA deadline, set when the request is logged. */
  dueAt: string;
  /** True only while the request is still open (submitted or approved) and past `dueAt`. */
  overdue: boolean;
  /** PMCM operator user id that owns the request, or null when unassigned. */
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One page of the PMCM privacy request queue. */
export interface PrismPrivacyRequestPage {
  items: PrismPrivacyRequest[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/** One owner's subject-scoped records in an access/export bundle. Records never include credentials or PMCM-internal notes. */
export interface PrismPrivacyExportSection {
  owner: "event-lifecycle" | "commercial" | "operations" | "identity-access";
  surface: string;
  records: Array<Record<string, string | number | boolean | null>>;
}

export interface PrismPrivacyExportBundle {
  requestId: string;
  subjectType: string;
  generatedAt: string;
  sections: PrismPrivacyExportSection[];
}

/** Result of executing a privacy request; `export` is present only for access and export requests. */
export interface PrismPrivacyExecutionResult extends PrismPrivacyRequest {
  export: PrismPrivacyExportBundle | null;
}

export interface PrismPrivacyLegalHold {
  id: string;
  subjectType: "client" | "supplier" | "guest";
  subjectEmail: string;
  subjectName: string;
  eventId: string | null;
  reason: string;
  placedById: string;
  placedByName: string;
  placedAt: string;
  releaseReason: string | null;
  releasedById: string | null;
  releasedByName: string | null;
  releasedAt: string | null;
  createdAt: string;
}

export interface PrismAuditExport {
  exportedAt: string;
  recordCount: number;
  rows: PrismAuditLog[];
}

export interface PrismNotificationLog {
  id: string;
  eventId?: string;
  channel: "email" | "viber" | "zoom" | "canva" | "storage" | "ai" | string;
  recipient: string;
  message: string;
  status: string;
  attempts: number;
  correlationId?: string | null;
  failureReason?: string | null;
  sentAt?: string | null;
  failedAt?: string | null;
  acknowledgedAt?: string | null;
  createdAt: string;
}

export interface PrismApprovalRequest {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  organization: string;
  status: string;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
  requestedAt: string;
}
