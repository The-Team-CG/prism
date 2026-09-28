import type { PrismInquiry } from '@prism/types';
import { describe, expect, it } from 'vitest';
import { canOfferConformeDraft, CONFORME_DRAFT_DELAY_MS, isCurrentConformeDraftWindow, parseConformeDraftReview } from './conforme-draft-review';

function inquiry(overrides: Partial<PrismInquiry> = {}): PrismInquiry {
  return {
    id: 'inq_1',
    status: 'accepted',
    conformeSentAt: new Date(0).toISOString(),
    conformeSignedAt: null,
    ...overrides,
  } as PrismInquiry;
}

describe('conforme draft review model', () => {
  it('offers drafts only five days after an accepted, unsigned conforme', () => {
    const sentAt = 1_000_000;
    expect(canOfferConformeDraft(inquiry({ conformeSentAt: new Date(sentAt).toISOString() }), sentAt + CONFORME_DRAFT_DELAY_MS - 1)).toBe(false);
    expect(canOfferConformeDraft(inquiry({ conformeSentAt: new Date(sentAt).toISOString() }), sentAt + CONFORME_DRAFT_DELAY_MS)).toBe(true);
    expect(canOfferConformeDraft(inquiry({ status: 'new' }), Date.now())).toBe(false);
    expect(canOfferConformeDraft(inquiry({ conformeSignedAt: new Date().toISOString() }), Date.now())).toBe(false);
  });

  it('validates the saved draft response before exposing it to the view', () => {
    const parsed = parseConformeDraftReview({
      draftId: 'aia_1',
      inquiryId: 'inq_1',
      draft: { subject: 'Subject', body: 'Body' },
      status: 'pending_human_approval',
      source: 'ai',
      requestedAt: '2026-09-24T12:00:00.000Z',
      reviewedBy: null,
      reviewedAt: null,
      lastConformeReminderAt: null,
      reminderWindowBaseAt: '2026-09-19T12:00:00.000Z',
      requestId: 'req_1',
      modelVersion: 'mock',
    });
    expect(parsed?.draft).toEqual({ subject: 'Subject', body: 'Body' });
    expect(parsed?.reminderWindowBaseAt).toBe('2026-09-19T12:00:00.000Z');
    expect(() => parseConformeDraftReview({ draftId: 'aia_1' })).toThrow('response is invalid');
  });

  it('distinguishes a saved draft from the current reminder window', () => {
    const parsed = parseConformeDraftReview({
      draftId: 'aia_1', inquiryId: 'inq_1', draft: { subject: 'Subject', body: 'Body' },
      status: 'approved', source: 'manual', requestedAt: '2026-09-24T12:00:00.000Z',
      reviewedBy: 'PMCM', reviewedAt: '2026-09-24T12:00:00.000Z', lastConformeReminderAt: null,
      reminderWindowBaseAt: '2026-09-19T12:00:00.000Z', requestId: 'req_1', modelVersion: 'manual',
    });
    expect(isCurrentConformeDraftWindow(parsed, inquiry({
      conformeSentAt: '2026-09-19T12:00:00.000Z', lastConformeReminderAt: '2026-09-24T12:00:00.000Z',
    }))).toBe(false);
  });

  it('treats the approval-created reminder as the current window until a later reminder is sent', () => {
    const approved = parseConformeDraftReview({
      draftId: 'aia_1', inquiryId: 'inq_1', draft: { subject: 'Subject', body: 'Body' },
      status: 'approved', source: 'manual', requestedAt: '2026-09-24T12:00:00.000Z',
      reviewedBy: 'PMCM', reviewedAt: '2026-09-24T12:00:00.000Z', lastConformeReminderAt: '2026-09-24T12:00:00.000Z',
      reminderWindowBaseAt: '2026-09-19T12:00:00.000Z', requestId: 'req_1', modelVersion: 'manual',
    });
    expect(isCurrentConformeDraftWindow(approved, inquiry({
      conformeSentAt: '2026-09-19T12:00:00.000Z', lastConformeReminderAt: '2026-09-24T12:00:00.000Z',
    }))).toBe(true);
    expect(isCurrentConformeDraftWindow(approved, inquiry({
      conformeSentAt: '2026-09-19T12:00:00.000Z', lastConformeReminderAt: '2026-09-30T12:00:00.000Z',
    }))).toBe(false);
  });
});
