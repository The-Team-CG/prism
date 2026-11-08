import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import {
  complianceAdvisoryInputSchema,
  complianceAdvisoryResultSchema,
  eventIntelligenceInputSchema,
  eventIntelligenceResultSchema,
  themeSuggestionInputSchema,
  themeSuggestionResultSchema,
  type ComplianceAdvisoryInput,
  type EventIntelligenceInput,
  type PrismVerifiedEventActor,
  type ThemeSuggestionInput,
} from '@prism/types';
import { PLATFORM_REFERENCE_READ_MODEL, type AiAdvisoryFacts, type PlatformReferenceReadModel } from '@prism/contexts/read-models';
import { AI_GATEWAY, type AiGateway } from '../../contracts/ai-governance/ai-gateway.port';
import { aiRunFailureToHttpException } from './ai-run-failure';

const DAY_MS = 86_400_000;
const strings = (value: unknown, limit: number) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, limit).map((item) => item.slice(0, 300)) : []);
const records = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : []);
const text = (value: unknown, limit: number) => (typeof value === 'string' ? value.slice(0, limit) : '');
const amount = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined);

/** FR-10+: the open checks of the latest compliance run, minimized. */
export function buildComplianceAdvisoryInput(facts: AiAdvisoryFacts, now: Date): ComplianceAdvisoryInput {
  if (facts.openChecks.length === 0) throw new BadRequestException('There are no open compliance items to explain');
  return complianceAdvisoryInputSchema.parse({
    eventType: facts.event.eventType, phase: facts.event.status,
    daysUntilEvent: Math.ceil((facts.event.eventDate.getTime() - now.getTime()) / DAY_MS),
    openChecks: facts.openChecks.map((check) => ({ title: check.title.slice(0, 200), severity: check.severity.slice(0, 40), evidence: strings(check.evidence, 3), remediation: check.remediation.slice(0, 400) })),
  });
}

/** FR-11: the briefing's styling facts; no client identity. */
export function buildThemeSuggestionInput(facts: AiAdvisoryFacts): ThemeSuggestionInput {
  if (!facts.briefing) throw new BadRequestException('Theme suggestions need a submitted briefing');
  return themeSuggestionInputSchema.parse({
    eventType: facts.event.eventType, guestCount: facts.briefing.guestCount || undefined,
    venueType: facts.briefing.venueType ?? undefined, moodAndStyling: facts.briefing.moodAndStyling.slice(0, 1_000),
    budgetRange: facts.briefing.budgetRange.slice(0, 120) || undefined, stylingBudget: facts.briefing.stylingBudget ?? undefined,
  });
}

/** FR-AI-08: the stored event insight, reduced to dimensions, risks, ratings and totals. */
export function buildEventIntelligenceInput(facts: AiAdvisoryFacts): EventIntelligenceInput {
  if (!facts.insight) throw new BadRequestException('Generate the event insights card before the intelligence report');
  const dimensions = Object.entries((facts.insight.dimensions ?? {}) as Record<string, Record<string, unknown>>).slice(0, 12)
    .map(([dimension, value]) => ({ dimension: dimension.slice(0, 80), status: text(value?.status, 20), summary: text(value?.summary, 400) }));
  const financial = (facts.insight.financialSummary ?? {}) as Record<string, unknown>;
  return eventIntelligenceInputSchema.parse({
    eventType: facts.event.eventType, guestCount: facts.briefing?.guestCount || undefined, checkedInGuests: facts.checkedInGuests,
    dimensions,
    risks: records(facts.insight.risks).slice(0, 20).map((risk) => ({ title: text(risk.title, 200), severity: text(risk.severity, 20), status: text(risk.status, 20) })),
    supplierRatings: records(facts.insight.supplierNotes).map((note) => note.rating).filter((rating): rating is number => typeof rating === 'number' && rating >= 0 && rating <= 5).slice(0, 50),
    totalBilled: amount(financial.totalBilled), outstandingAmount: amount(financial.outstandingAmount),
    clientRating: facts.clientRating ?? undefined,
  });
}

/** FR-10+, FR-11 and FR-AI-08: PMCM-only AI advice built from the event record. Nothing is applied or sent. */
@Injectable()
export class AiAdvisoryService {
  constructor(
    @Inject(AI_GATEWAY) private readonly aiGateway: AiGateway,
    private readonly access: EventAccessPolicyService,
    @Inject(PLATFORM_REFERENCE_READ_MODEL) private readonly references: PlatformReferenceReadModel,
  ) {}

  private async facts(eventId: string, verifiedActor: PrismVerifiedEventActor, resource: string) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], resource, eventId);
    const facts = await this.references.findAiAdvisoryFacts(eventId);
    if (!facts) throw new NotFoundException('Event not found');
    return facts;
  }

  async complianceAdvisory(eventId: string, verifiedActor: PrismVerifiedEventActor) {
    const result = await this.aiGateway.run('compliance.advisory', buildComplianceAdvisoryInput(await this.facts(eventId, verifiedActor, 'compliance advisory'), new Date()));
    if (result.outcome !== 'completed') throw aiRunFailureToHttpException(result);
    return complianceAdvisoryResultSchema.parse(result.output);
  }

  async themeSuggestions(eventId: string, verifiedActor: PrismVerifiedEventActor) {
    const result = await this.aiGateway.run('theme.suggestions', buildThemeSuggestionInput(await this.facts(eventId, verifiedActor, 'theme suggestions')));
    if (result.outcome !== 'completed') throw aiRunFailureToHttpException(result);
    return themeSuggestionResultSchema.parse(result.output);
  }

  async eventIntelligence(eventId: string, verifiedActor: PrismVerifiedEventActor) {
    const result = await this.aiGateway.run('event.intelligence', buildEventIntelligenceInput(await this.facts(eventId, verifiedActor, 'event intelligence report')));
    if (result.outcome !== 'completed') throw aiRunFailureToHttpException(result);
    return eventIntelligenceResultSchema.parse(result.output);
  }
}
