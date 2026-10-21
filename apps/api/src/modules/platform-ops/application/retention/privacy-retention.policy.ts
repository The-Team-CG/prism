import {
  PLATFORM_RETENTION_SOURCE_CATEGORIES,
  type PlatformRetentionCandidate,
  type PlatformRetentionSourceCategory,
} from '@prism/contexts/read-models';
import {
  PRIVACY_RETENTION_CATEGORIES,
  type PrismRetentionPolicy,
  type PrismRetentionPolicyHistoryEntry,
  type PrivacyRetentionAction,
  type PrivacyRetentionAnchor,
  type PrivacyRetentionCategory,
} from '@prism/types';
import { privacyRequestLegalHoldScope, type PrivacyLegalHoldScope } from '../trust/privacy-legal-hold.policy';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const RETENTION_HISTORY_LIMIT = 50;

type CategoryDescriptor = {
  /** Data categories the policy governs; mirrors the privacy inventory vocabulary. */
  dataCategories: string[];
  /** Only categories with a candidate source and a redactor can be enabled; others are reference-only. */
  sweepable: boolean;
};

const CATEGORY_DESCRIPTORS: Record<PrivacyRetentionCategory, CategoryDescriptor> = {
  inquiry: { dataCategories: ['client_contact', 'event_details', 'consent'], sweepable: true },
  approval_request: { dataCategories: ['email', 'role', 'organization', 'consent'], sweepable: false },
  supplier: { dataCategories: ['supplier_contact', 'certification_metadata', 'performance_notes'], sweepable: false },
  guest_check_in: { dataCategories: ['guest_name', 'attendance', 'consent'], sweepable: true },
  guest_feedback: { dataCategories: ['guest_name', 'rating', 'comment', 'media_metadata', 'consent'], sweepable: true },
  documents: { dataCategories: ['file_metadata', 'uploader_role', 'validation_result'], sweepable: false },
  audit: { dataCategories: ['actor', 'action', 'affected_record', 'hash_chain'], sweepable: false },
  legal_hold: { dataCategories: ['subject_identity', 'hold_reason', 'placement_and_release_actor'], sweepable: false },
};

/** Fixed per category: the anchor is a code decision, not an operator setting. */
const CATEGORY_ANCHORS: Record<PrivacyRetentionCategory, PrivacyRetentionAnchor> = {
  inquiry: 'event_archived_at',
  approval_request: 'record_created_at',
  supplier: 'record_created_at',
  guest_check_in: 'event_archived_at',
  guest_feedback: 'event_archived_at',
  documents: 'event_archived_at',
  audit: 'record_created_at',
  legal_hold: 'record_created_at',
};

const ANCHOR_LABELS: Record<PrivacyRetentionAnchor, string> = {
  event_archived_at: 'event archive',
  event_end: 'event end',
  record_created_at: 'record creation',
  inquiry_declined_at: 'inquiry decline',
};

export function isSweepableCategory(category: PrivacyRetentionCategory): boolean {
  return CATEGORY_DESCRIPTORS[category].sweepable;
}

export function isSourceCategory(category: PrivacyRetentionCategory): category is PlatformRetentionSourceCategory {
  return (PLATFORM_RETENTION_SOURCE_CATEGORIES as readonly string[]).includes(category);
}

/** Stored actions come from the seeded migration and the policy service only; anything unknown degrades to the review-only default. */
export function asRetentionAction(value: string): PrivacyRetentionAction {
  return value === 'review_delete' ? 'review_delete' : 'review_anonymize';
}

export function retentionCutoff(now: Date, periodDays: number): Date {
  return new Date(now.getTime() - periodDays * DAY_MS);
}

export function retentionDueSince(anchorAt: Date, periodDays: number): Date {
  return new Date(anchorAt.getTime() + periodDays * DAY_MS);
}

/** Legal holds are matched on the same identity scope that privacy requests use, so placement and execution agree. */
export function candidateHoldScope(candidate: PlatformRetentionCandidate): PrivacyLegalHoldScope {
  if (candidate.category === 'inquiry') {
    return privacyRequestLegalHoldScope({ subjectType: 'client', subjectEmail: candidate.subjectEmail, subjectName: '', eventId: candidate.eventId });
  }
  return privacyRequestLegalHoldScope({ subjectType: 'guest', subjectEmail: '', subjectName: candidate.subjectName, eventId: candidate.eventId });
}

export type RetentionPolicyRow = {
  category: string;
  label: string;
  description: string;
  periodDays: number;
  anchor: string;
  action: string;
  enabled: boolean;
  revision: number;
  updatedBy: string;
  updatedAt: Date;
  history: unknown;
};

export function mapRetentionPolicy(row: RetentionPolicyRow): PrismRetentionPolicy {
  const category = row.category as PrivacyRetentionCategory;
  const descriptor = CATEGORY_DESCRIPTORS[category];
  const anchor = row.anchor as PrivacyRetentionAnchor;
  return {
    surface: row.category,
    dataCategories: descriptor.dataCategories,
    retentionPeriod: `${row.periodDays} days after ${ANCHOR_LABELS[anchor]}${row.enabled ? '' : ' (disabled)'}`,
    deletionBehavior: row.description,
    category,
    label: row.label,
    periodDays: row.periodDays,
    anchor,
    action: asRetentionAction(row.action),
    enabled: row.enabled,
    sweepable: descriptor.sweepable,
    revision: row.revision,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
    history: parseRetentionHistory(row.history),
  };
}

export function sortRetentionPolicies<T extends { category: string }>(rows: T[]): T[] {
  const order = new Map(PRIVACY_RETENTION_CATEGORIES.map((category, index) => [category, index]));
  return [...rows].sort((a, b) => (order.get(a.category as PrivacyRetentionCategory) ?? 0) - (order.get(b.category as PrivacyRetentionCategory) ?? 0));
}

/** History is written only by the policy service; malformed legacy entries are dropped rather than trusted. */
export function parseRetentionHistory(value: unknown): PrismRetentionPolicyHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): PrismRetentionPolicyHistoryEntry[] => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    if (
      typeof record.revision !== 'number' ||
      typeof record.changedBy !== 'string' ||
      typeof record.changedAt !== 'string' ||
      typeof record.reason !== 'string' ||
      typeof record.enabled !== 'boolean' ||
      typeof record.periodDays !== 'number' ||
      typeof record.action !== 'string'
    ) {
      return [];
    }
    return [{
      revision: record.revision,
      changedBy: record.changedBy,
      changedAt: record.changedAt,
      reason: record.reason,
      enabled: record.enabled,
      periodDays: record.periodDays,
      action: asRetentionAction(record.action),
    }];
  });
}
