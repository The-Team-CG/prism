import { describe, expect, it } from 'vitest';
import { supplierReliabilityScore } from './supplier-reliability-score';

const factor = (successes: number, observations: number) => ({ successes, observations });

describe('FR-AI-06 supplier reliability score', () => {
  it('starts uncertain at 50 and narrows toward the evidence as history grows', () => {
    const none = supplierReliabilityScore({ onTime: factor(0, 0), noComplaints: factor(0, 0), responsive: factor(0, 0), contractAccuracy: factor(0, 0) });
    expect(none).toMatchObject({ score: 50, observations: 0 });
    const strong = supplierReliabilityScore({ onTime: factor(20, 20), noComplaints: factor(19, 20), responsive: factor(18, 20), contractAccuracy: factor(20, 20) });
    const weak = supplierReliabilityScore({ onTime: factor(4, 10), noComplaints: factor(5, 10), responsive: factor(3, 10), contractAccuracy: factor(8, 10) });
    expect(strong.score).toBeGreaterThan(85);
    expect(weak.score).toBeLessThan(55);
    expect(strong.high - strong.low).toBeLessThan(none.high - none.low);
    expect(strong.low).toBeLessThanOrEqual(strong.score);
    expect(strong.high).toBeGreaterThanOrEqual(strong.score);
  });
});
