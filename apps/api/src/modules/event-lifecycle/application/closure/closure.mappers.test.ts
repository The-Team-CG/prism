import { describe, expect, it } from 'vitest';
import { mapClientVisibleEventInsight, mapEventInsight } from './closure.mappers';

describe('closure insight mappers', () => {
  const insight = {
    id: 'ins_1',
    eventId: 'evt_sample',
    summary: 'Closed cleanly',
    highlights: ['Paid'],
    risks: [],
    supplierNotes: [],
    financialSummary: { totalBilled: 100000 },
    documentSummary: { total: 2 },
    feedbackSummary: { supplierReviews: 1 },
    privateNotes: 'PMCM-only residual notes',
    generatedAt: new Date('2026-07-21T00:00:00.000Z'),
    updatedAt: new Date('2026-07-21T01:00:00.000Z'),
  };

  it('keeps private notes on the PMCM insight mapper', () => {
    expect(mapEventInsight(insight as never).privateNotes).toBe('PMCM-only residual notes');
  });

  it('omits private notes from the client-visible insight mapper', () => {
    const visible = mapClientVisibleEventInsight(insight as never);
    expect(visible).not.toHaveProperty('privateNotes');
    expect(JSON.stringify(visible)).not.toContain('PMCM-only residual notes');
    expect(visible.summary).toBe('Closed cleanly');
  });
});
