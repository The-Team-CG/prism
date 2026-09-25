import { conformeDraftReviewSchema, type ConformeDraftReviewRecord, type PrismInquiry } from '@prism/types';

export const CONFORME_DRAFT_DELAY_MS = 5 * 24 * 60 * 60 * 1000;

export function canOfferConformeDraft(inquiry: PrismInquiry, now = Date.now()) {
  if (inquiry.status !== 'accepted' || inquiry.conformeSignedAt || !inquiry.conformeSentAt) return false;
  const reminderWindowBaseAt = Date.parse(inquiry.lastConformeReminderAt ?? inquiry.conformeSentAt);
  return Number.isFinite(reminderWindowBaseAt) && now - reminderWindowBaseAt >= CONFORME_DRAFT_DELAY_MS;
}

export function parseConformeDraftReview(value: unknown): ConformeDraftReviewRecord | null {
  if (value === null) return null;
  const parsed = conformeDraftReviewSchema.safeParse(value);
  if (!parsed.success) throw new Error('The saved draft response is invalid. Refresh and try again.');
  return parsed.data;
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
