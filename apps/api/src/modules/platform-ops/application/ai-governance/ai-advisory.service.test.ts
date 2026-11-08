import { describe, expect, it } from 'vitest';
import type { AiAdvisoryFacts } from '@prism/contexts/read-models';
import { AI_USE_CASE_REGISTRY } from './gateway/ai-use-cases';
import { buildComplianceAdvisoryInput, buildEventIntelligenceInput, buildThemeSuggestionInput } from './ai-advisory.service';

const facts: AiAdvisoryFacts = {
  event: { eventType: 'Wedding', eventDate: new Date('2027-02-14T00:00:00.000Z'), status: 'planning' },
  briefing: { guestCount: 180, venueType: 'Garden', moodAndStyling: 'Rustic, warm lights, eucalyptus', budgetRange: 'PHP 1M - 1.5M', stylingBudget: 250000 },
  openChecks: [{ title: 'Weddings: Catering is confirmed', severity: 'must_fix', evidence: ['No confirmed catering supplier among 2 supplier request(s).', { not: 'text' }], remediation: 'Confirm a catering supplier.' }],
  insight: {
    dimensions: { suppliers: { status: 'evidence', summary: 'All suppliers arrived on time.' }, guests: { status: 'pending', summary: 'Feedback still open.' } },
    risks: [{ title: 'Rain', severity: 'medium', status: 'closed', owner: 'Maxine Cruz' }],
    supplierNotes: [{ supplierId: 'sup_1', rating: 5, notes: 'Called Ana at 0917', reviewedBy: 'Maxine' }, { rating: 3 }],
    financialSummary: { totalBilled: 1_200_000, outstandingAmount: 0 },
  },
  checkedInGuests: 172,
  clientRating: 5,
};

/** Every string field of a use case input must be declared free text, or the gateway replaces it with "[free text redacted]". */
function stringKeys(value: unknown, key = ''): string[] {
  if (typeof value === 'string') return [key];
  if (Array.isArray(value)) return value.flatMap((item) => stringKeys(item, key));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([child, item]) => stringKeys(item, child));
  return [];
}

describe('AI advisories (FR-10+, FR-11, FR-AI-08)', () => {
  it('sends the model only the minimized facts each use case declares as free text', () => {
    const inputs = {
      'compliance.advisory': buildComplianceAdvisoryInput(facts, new Date('2027-01-14T00:00:00.000Z')),
      'theme.suggestions': buildThemeSuggestionInput(facts),
      'event.intelligence': buildEventIntelligenceInput(facts),
    } as const;
    for (const [useCase, input] of Object.entries(inputs)) {
      const declared = new Set(AI_USE_CASE_REGISTRY[useCase as keyof typeof inputs].freeTextKeys ?? []);
      expect(stringKeys(input).filter((key) => !declared.has(key))).toEqual([]);
    }
    expect(inputs['compliance.advisory']).toMatchObject({ daysUntilEvent: 31, openChecks: [{ evidence: ['No confirmed catering supplier among 2 supplier request(s).'] }] });
    expect(inputs['event.intelligence']).toMatchObject({ supplierRatings: [5, 3], checkedInGuests: 172, totalBilled: 1_200_000 });
    expect(JSON.stringify(inputs['event.intelligence'])).not.toMatch(/Maxine|Ana|0917/);
  });

  it('refuses advice that would have nothing to work from', () => {
    expect(() => buildComplianceAdvisoryInput({ ...facts, openChecks: [] }, new Date())).toThrow('no open compliance items');
    expect(() => buildThemeSuggestionInput({ ...facts, briefing: null })).toThrow('submitted briefing');
    expect(() => buildEventIntelligenceInput({ ...facts, insight: null })).toThrow('insights card');
  });
});
