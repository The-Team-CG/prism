import { describe, expect, it } from 'vitest';
import { eventDecisionSchema, recordEventDecisionSchema } from './event-ops-inputs.js';

const reviewed = { reason: 'Client confirmed', cancellationFeeAmount: 0, depositTreatment: 'waive', supplierImpact: 'preserve_obligations', impactReviewAcknowledged: true } as const;

describe('eventDecisionSchema', () => {
  it('requires a replacement date when postponing', () => {
    expect(eventDecisionSchema.safeParse({ ...reviewed, decision: 'postponed' }).success).toBe(false);
  });

  it('accepts cancellation with explicit financial and supplier treatment', () => {
    expect(eventDecisionSchema.parse({ ...reviewed, decision: 'cancelled', cancellationFeeAmount: 12500, depositTreatment: 'retain', supplierImpact: 'release_obligations' })).toMatchObject({ decision: 'cancelled', cancellationFeeAmount: 12500 });
  });

  it('rejects impact review that is left unresolved (cannot be silently skipped)', () => {
    expect(eventDecisionSchema.safeParse({ ...reviewed, decision: 'cancelled', supplierImpact: 'pending_review' }).success).toBe(false);
    expect(eventDecisionSchema.safeParse({ ...reviewed, decision: 'cancelled', depositTreatment: 'pending_review' }).success).toBe(false);
    expect(eventDecisionSchema.safeParse({ ...reviewed, decision: 'postponed', newEventDate: '2026-12-10', cancellationFeeAmount: 500, depositTreatment: 'pending_review' }).success).toBe(false);
    expect(eventDecisionSchema.safeParse({ reason: 'Venue hold pending', decision: 'date_to_be_confirmed', impactReviewAcknowledged: true }).success).toBe(false);
    expect(eventDecisionSchema.safeParse({ ...reviewed, decision: 'date_to_be_confirmed' }).success).toBe(true);
  });

  it('requires the impact review to be confirmed at the PMCM write boundary', () => {
    const { impactReviewAcknowledged: _unused, ...unreviewed } = reviewed;
    expect(recordEventDecisionSchema.safeParse({ ...unreviewed, decision: 'cancelled' }).success).toBe(false);
    expect(recordEventDecisionSchema.safeParse({ ...reviewed, impactReviewAcknowledged: false, decision: 'cancelled' }).success).toBe(false);
    expect(recordEventDecisionSchema.safeParse({ ...reviewed, decision: 'cancelled' }).success).toBe(true);
  });

  it('applies the same treatment rules at the write boundary as in the shared decision contract', () => {
    expect(recordEventDecisionSchema.safeParse({ ...reviewed, decision: 'cancelled', supplierImpact: 'pending_review' }).success).toBe(false);
    expect(recordEventDecisionSchema.safeParse({ ...reviewed, decision: 'postponed' }).success).toBe(false);
  });
});
