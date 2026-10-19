import type { PrismPrivacyRetentionPolicy } from "./trust.js";
import type {
  PrivacyRetentionAction,
  PrivacyRetentionAnchor,
  PrivacyRetentionCategory,
  PrivacyRetentionItemStatus,
} from "../schemas/privacy-retention-inputs.js";

/** Persisted retention policy. Extends the legacy surface shape so the existing audit-trail panel keeps rendering. */
export interface PrismRetentionPolicy extends PrismPrivacyRetentionPolicy {
  category: PrivacyRetentionCategory;
  label: string;
  periodDays: number;
  anchor: PrivacyRetentionAnchor;
  action: PrivacyRetentionAction;
  enabled: boolean;
  /** False when no sweep candidate source and executor exist; such policies cannot be enabled. */
  sweepable: boolean;
  revision: number;
  updatedBy: string;
  updatedAt: string;
  history: PrismRetentionPolicyHistoryEntry[];
}

export interface PrismRetentionPolicyHistoryEntry {
  revision: number;
  changedBy: string;
  changedAt: string;
  reason: string;
  enabled: boolean;
  periodDays: number;
  action: PrivacyRetentionAction;
}

/** A record past its retention period, queued for PMCM review. Nothing is changed until an operator executes it. */
export interface PrismRetentionReviewItem {
  id: string;
  category: PrivacyRetentionCategory;
  subjectType: string;
  subjectId: string;
  eventId: string | null;
  subjectEmail: string;
  subjectName: string;
  anchorAt: string;
  dueSince: string;
  status: PrivacyRetentionItemStatus;
  decisionReason: string;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

/** Execution result: counts and surface names only, never record contents. */
export interface PrismRetentionExecutionResult extends PrismRetentionReviewItem {
  touchedRecords: number;
  surfaces: string[];
}
