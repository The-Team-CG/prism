import { commsDraftResultSchema, type CommsDraftResult, type PrismInquiry } from '@prism/types';

export const CONFORME_DRAFT_DELAY_MS = 5 * 24 * 60 * 60 * 1000;

export type ConformeDraftReviewRecord = {
  draftId: string;
  inquiryId: string;
  draft: CommsDraftResult;
  status: string;
  source: 'ai' | 'manual';
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  lastConformeReminderAt: string | null;
  reminderWindowBaseAt: string;
  requestId: string;
  modelVersion: string;
};

export function canOfferConformeDraft(inquiry: PrismInquiry, now = Date.now()) {
  if (inquiry.status !== 'accepted' || inquiry.conformeSignedAt || !inquiry.conformeSentAt) return false;
  const reminderWindowBaseAt = Date.parse(inquiry.lastConformeReminderAt ?? inquiry.conformeSentAt);
  return Number.isFinite(reminderWindowBaseAt) && now - reminderWindowBaseAt >= CONFORME_DRAFT_DELAY_MS;
}

export function parseConformeDraftReview(value: unknown): ConformeDraftReviewRecord | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The saved draft response is invalid. Refresh and try again.');
  }
  const record = value as Record<string, unknown>;
  const draft = commsDraftResultSchema.safeParse(record.draft);
  if (
    typeof record.draftId !== 'string' ||
    typeof record.inquiryId !== 'string' ||
    typeof record.status !== 'string' ||
    (record.source !== 'ai' && record.source !== 'manual') ||
    typeof record.requestedAt !== 'string' ||
    typeof record.requestId !== 'string' ||
    typeof record.modelVersion !== 'string' ||
    (record.reviewedBy !== null && typeof record.reviewedBy !== 'string') ||
    (record.reviewedAt !== null && typeof record.reviewedAt !== 'string') ||
    (record.lastConformeReminderAt !== null && typeof record.lastConformeReminderAt !== 'string') ||
    typeof record.reminderWindowBaseAt !== 'string' ||
    !draft.success
  ) {
    throw new Error('The saved draft response is invalid. Refresh and try again.');
  }
  return {
    draftId: record.draftId,
    inquiryId: record.inquiryId,
    draft: draft.data,
    status: record.status,
    source: record.source,
    requestedAt: record.requestedAt,
    reviewedBy: record.reviewedBy,
    reviewedAt: record.reviewedAt,
    lastConformeReminderAt: record.lastConformeReminderAt,
    reminderWindowBaseAt: record.reminderWindowBaseAt,
    requestId: record.requestId,
    modelVersion: record.modelVersion,
  };
}

export function isCurrentConformeDraftWindow(
  draft: ConformeDraftReviewRecord | null,
  inquiry: PrismInquiry,
) {
  if (!draft) return false;
  const currentBase = inquiry.lastConformeReminderAt ?? inquiry.conformeSentAt;
  if (draft.status === 'approved' && inquiry.lastConformeReminderAt) {
    return Date.parse(draft.lastConformeReminderAt ?? '') === Date.parse(inquiry.lastConformeReminderAt);
  }
  return Boolean(currentBase && Date.parse(draft.reminderWindowBaseAt) === Date.parse(currentBase));
}
