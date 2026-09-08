import { describe, expect, it } from 'vitest';
import { eventDecisionSchema } from './event-ops-inputs.js';

describe('eventDecisionSchema', () => {
  it('requires a replacement date when postponing', () => {
    expect(eventDecisionSchema.safeParse({ decision: 'postponed', reason: 'Venue unavailable' }).success).toBe(false);
  });

  it('accepts cancellation with explicit financial and supplier treatment', () => {
    expect(eventDecisionSchema.parse({ decision: 'cancelled', reason: 'Client confirmed', cancellationFeeAmount: 12500, depositTreatment: 'retain', supplierImpact: 'release_obligations' })).toMatchObject({ decision: 'cancelled', cancellationFeeAmount: 12500 });
  });
});
