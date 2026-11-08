import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AiAdvisoryFacts, EventDayCopilotFacts, OperationsAssistantFacts } from '@prism/contexts/read-models';
import { AI_USE_CASE_REGISTRY } from './gateway/ai-use-cases';
import { AiAdvisoryService, buildComplianceAdvisoryInput, buildEventDayCopilotInput, buildEventIntelligenceInput, buildOperationsAssistantInput, buildThemeSuggestionInput } from './ai-advisory.service';

const now = new Date('2027-02-14T15:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const dayFacts: EventDayCopilotFacts = {
  eventType: 'Wedding',
  operatorCoordinatorIds: ['coord_op'],
  suppliers: [
    { category: 'Catering', eventDayStatus: 'not_started', ingressAt: minutesAgo(47) },
    { category: 'Lights', eventDayStatus: 'set_up_ready', ingressAt: minutesAgo(120) },
  ],
  openTasks: [
    { title: 'Brief ushers', priority: 'high', assignedRole: 'Program Coordinator', dueAt: minutesAgo(22) },
    { title: 'Toast', priority: 'normal', assignedRole: 'General Coordinator', dueAt: new Date(now.getTime() + 600_000) },
  ],
  attendance: [{ attendanceStatus: 'present' }, { attendanceStatus: 'absent' }, { attendanceStatus: 'pending' }],
  checkedIn: 40, checkedInLastHour: 12, expectedGuests: 180,
  openIssues: [{ title: 'Generator noise', severity: 'high', createdAt: minutesAgo(31), slaDueAt: minutesAgo(1) }],
};
const assistantFacts: OperationsAssistantFacts = {
  eventType: 'Wedding', eventDate: new Date('2027-02-24T00:00:00.000Z'), phase: 'planning', guestCount: 180, proposalStatus: 'approved', floorPlanStatus: 'approved',
  suppliersRequested: 6, suppliersConfirmed: 4, openTasks: 3, overdueTasks: 1, openIssues: 0, openComplianceItems: 2, outstandingBalance: 250000, checkedInGuests: 0,
};

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
      'event-day.copilot': buildEventDayCopilotInput(dayFacts, now),
      'operations.assistant': buildOperationsAssistantInput(assistantFacts, { question: 'What is blocking supplier confirmation?', history: [] }, now),
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

  it('gives the copilot only what still needs attention, in five-minute steps', () => {
    expect(buildEventDayCopilotInput(dayFacts, now)).toEqual({
      eventType: 'Wedding',
      suppliers: [{ category: 'Catering', status: 'not_started', minutesPastIngress: 45 }],
      overdueTasks: [{ title: 'Brief ushers', priority: 'high', role: 'Program Coordinator', minutesOverdue: 20 }],
      coordinators: { assigned: 3, present: 1, late: 0, absent: 1, notMarked: 1 },
      checkIns: { checkedIn: 40, lastHour: 12, expected: 180 },
      openIssues: [{ title: 'Generator noise', severity: 'high', minutesOpen: 30, slaBreached: true }],
    });
  });
});

describe('event-day copilot and operations assistant (FR-AI-07, FR-AI-05)', () => {
  function serviceFor(actor: Record<string, unknown>) {
    const gateway = { run: vi.fn(async (useCase: string) => ({ outcome: 'completed', output: useCase === 'event-day.copilot' ? { summary: 'One supplier is late.', alerts: [] } : { answer: 'Two suppliers are unconfirmed.', basedOn: ['suppliers'], suggestedNextSteps: [] } })) };
    const access = { resolveActor: vi.fn(() => actor), requireActorRole: vi.fn(async () => undefined), recordForbiddenAccess: vi.fn(async () => undefined) };
    const references = { findEventDayCopilotFacts: vi.fn(async () => dayFacts), findOperationsAssistantFacts: vi.fn(async () => assistantFacts) };
    return { service: new AiAdvisoryService(gateway as never, access as never, references as never), gateway, access, references };
  }

  it('lets only PMCM or the designated operator see the copilot, and reuses advice while the facts are unchanged', async () => {
    const coordinator = serviceFor({ role: 'coordinator', coordinatorId: 'coord_other', name: 'C' });
    await expect(coordinator.service.eventDayCopilot('evt_1', {} as never, now)).rejects.toBeInstanceOf(ForbiddenException);
    expect(coordinator.access.recordForbiddenAccess).toHaveBeenCalled();
    expect(coordinator.gateway.run).not.toHaveBeenCalled();

    const operator = serviceFor({ role: 'coordinator', coordinatorId: 'coord_op', name: 'Op' });
    const first = await operator.service.eventDayCopilot('evt_1', {} as never, now);
    const poll = await operator.service.eventDayCopilot('evt_1', {} as never, new Date(now.getTime() + 60_000));
    expect(poll).toEqual(first);
    expect(operator.gateway.run).toHaveBeenCalledTimes(1);
    operator.references.findEventDayCopilotFacts.mockResolvedValueOnce({ ...dayFacts, checkedIn: 90 });
    await operator.service.eventDayCopilot('evt_1', {} as never, new Date(now.getTime() + 120_000));
    expect(operator.gateway.run).toHaveBeenCalledTimes(2);
  });

  it('answers PMCM from counts only and keeps at most three earlier turns', async () => {
    const pmcm = serviceFor({ role: 'pmcm-admin', name: 'PMCM' });
    const history = Array.from({ length: 4 }, (_, index) => ({ question: `Q${index}`, answer: `A${index}` }));
    await expect(pmcm.service.askOperationsAssistant('evt_1', { question: 'What is blocking supplier confirmation?', history }, {} as never, now)).resolves.toMatchObject({ basedOn: ['suppliers'] });
    const [, input] = pmcm.gateway.run.mock.calls[0] as unknown as [string, { history: unknown[]; facts: Record<string, unknown> }];
    expect(input.history).toEqual(history.slice(1));
    expect(input.facts).toMatchObject({ suppliersRequested: 6, suppliersConfirmed: 4, outstandingBalance: 250000 });
    expect(pmcm.access.requireActorRole).toHaveBeenCalledWith(expect.anything(), ['pmcm-admin'], 'operations assistant', 'evt_1');
  });
});
