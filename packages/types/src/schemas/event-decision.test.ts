import { describe, expect, it } from 'vitest';
import { eventDecisionSchema } from './event-ops-inputs.js';

describe('eventDecisionSchema', () => {
  it('requires a replacement date when postponing', () => {
    expect(eventDecisionSchema.safeParse({ decision: 'postponed', reason: 'Venue unavailable' }).success).toBe(false);
  });

  it('accepts cancellation with explicit financial and supplier treatment', () => {
    expect(eventDecisionSchema.parse({ decision: 'cancelled', reason: 'Client confirmed', cancellationFeeAmount: 12500, depositTreatment: 'retain', supplierImpact: 'release_obligations' })).toMatchObject({ decision: 'cancelled', cancellationFeeAmount: 12500 });
  });

  it('rejects impact review that is left unresolved (cannot be silently skipped)', () => {
    const base = { reason: 'Client confirmed', cancellationFeeAmount: 0, depositTreatment: 'waive', supplierImpact: 'preserve_obligations' } as const;
    expect(eventDecisionSchema.safeParse({ ...base, decision: 'cancelled', supplierImpact: 'pending_review' }).success).toBe(false);
    expect(eventDecisionSchema.safeParse({ ...base, decision: 'cancelled', depositTreatment: 'pending_review' }).success).toBe(false);
    expect(eventDecisionSchema.safeParse({ ...base, decision: 'postponed', newEventDate: '2026-12-10', cancellationFeeAmount: 500, depositTreatment: 'pending_review' }).success).toBe(false);
    expect(eventDecisionSchema.safeParse({ reason: 'Venue hold pending', decision: 'date_to_be_confirmed' }).success).toBe(false);
    expect(eventDecisionSchema.safeParse({ ...base, decision: 'date_to_be_confirmed' }).success).toBe(true);
  });
});
