import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import {
  complianceAdvisoryInputSchema,
  complianceAdvisoryResultSchema,
  eventDayCopilotInputSchema,
  eventDayCopilotResultSchema,
  operationsAssistantInputSchema,
  operationsAssistantResultSchema,
  type AskOperationsAssistantInput,
  type EventDayCopilotInput,
  type OperationsAssistantInput,
  type PrismEventDayCopilot,
  eventIntelligenceInputSchema,
  eventIntelligenceResultSchema,
  themeSuggestionInputSchema,
  themeSuggestionResultSchema,
  type ComplianceAdvisoryInput,
  type EventIntelligenceInput,
  type PrismVerifiedEventActor,
  type ThemeSuggestionInput,
} from '@prism/types';
import { PLATFORM_REFERENCE_READ_MODEL, type AiAdvisoryFacts, type EventDayCopilotFacts, type OperationsAssistantFacts, type PlatformReferenceReadModel } from '@prism/contexts/read-models';
import { AI_GATEWAY, type AiGateway } from '../../contracts/ai-governance/ai-gateway.port';
import { aiRunFailureToHttpException } from './ai-run-failure';
import { digestJson } from './json-digest';

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
/** FR-AI-07: the panel polls every minute; unchanged facts reuse the last advice for up to ten minutes. */
const COPILOT_REUSE_MS = 10 * MINUTE_MS;
const minutesBetween = (later: Date, earlier: Date) => Math.floor((later.getTime() - earlier.getTime()) / MINUTE_MS);
const CLOSED_SUPPLIER_STATUSES = ['set_up_ready', 'done_leaving'];
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

/**
 * FR-AI-07: the live state an operator needs, minimized. Minutes are relative and rounded to five, so a quiet event
 * produces the same input from one poll to the next and the cached advice is reused.
 */
export function buildEventDayCopilotInput(facts: EventDayCopilotFacts, now: Date): EventDayCopilotInput {
  const roundTo5 = (minutes: number) => Math.floor(minutes / 5) * 5;
  const count = (status: string) => facts.attendance.filter((row) => row.attendanceStatus === status).length;
  return eventDayCopilotInputSchema.parse({
    eventType: facts.eventType,
    suppliers: facts.suppliers.filter((supplier) => !CLOSED_SUPPLIER_STATUSES.includes(supplier.eventDayStatus)).map((supplier) => ({
      category: supplier.category.slice(0, 80), status: supplier.eventDayStatus.slice(0, 30),
      minutesPastIngress: supplier.ingressAt ? roundTo5(minutesBetween(now, supplier.ingressAt)) : 0,
    })),
    overdueTasks: facts.openTasks.filter((task) => task.dueAt && task.dueAt < now).slice(0, 30).map((task) => ({
      title: task.title.slice(0, 200), priority: task.priority.slice(0, 20), role: task.assignedRole.slice(0, 80),
      minutesOverdue: roundTo5(minutesBetween(now, task.dueAt as Date)),
    })),
    coordinators: { assigned: facts.attendance.length, present: count('present'), late: count('late'), absent: count('absent'), notMarked: count('pending') },
    checkIns: { checkedIn: facts.checkedIn, lastHour: facts.checkedInLastHour, ...(facts.expectedGuests ? { expected: facts.expectedGuests } : {}) },
    openIssues: facts.openIssues.map((issue) => ({
      title: issue.title.slice(0, 200), severity: issue.severity.slice(0, 20),
      minutesOpen: roundTo5(Math.max(0, minutesBetween(now, issue.createdAt))), slaBreached: Boolean(issue.slaDueAt && issue.slaDueAt < now),
    })),
  });
}

/** FR-AI-05: the question, up to three earlier turns, and event-level counts. No names, contacts or per-party amounts. */
export function buildOperationsAssistantInput(facts: OperationsAssistantFacts, ask: AskOperationsAssistantInput, now: Date): OperationsAssistantInput {
  return operationsAssistantInputSchema.parse({
    question: ask.question,
    history: (ask.history ?? []).slice(-3),
    event: { eventType: facts.eventType, phase: facts.phase.slice(0, 40), daysUntilEvent: Math.ceil((facts.eventDate.getTime() - now.getTime()) / DAY_MS), ...(facts.guestCount ? { guestCount: facts.guestCount } : {}) },
    facts: {
      suppliersRequested: facts.suppliersRequested, suppliersConfirmed: facts.suppliersConfirmed, openTasks: facts.openTasks, overdueTasks: facts.overdueTasks,
      openIssues: facts.openIssues, openComplianceItems: facts.openComplianceItems, outstandingBalance: facts.outstandingBalance,
      checkedInGuests: facts.checkedInGuests, proposalStatus: facts.proposalStatus.slice(0, 40), floorPlanStatus: facts.floorPlanStatus.slice(0, 40),
    },
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

  private readonly copilotCache = new Map<string, { digest: string; at: number; advice: PrismEventDayCopilot }>();

  /** FR-AI-07: PMCM or the event's designated operator. Advice only; the operator acts in the live operations board. */
  async eventDayCopilot(eventId: string, verifiedActor: PrismVerifiedEventActor, now = new Date()): Promise<PrismEventDayCopilot> {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.Coordinator], 'event-day copilot', eventId);
    const facts = await this.references.findEventDayCopilotFacts(eventId, now);
    if (!facts) throw new NotFoundException('Event not found');
    if (actor.role === OpsUserRole.Coordinator && (!actor.coordinatorId || !facts.operatorCoordinatorIds.includes(actor.coordinatorId))) {
      await this.access.recordForbiddenAccess(actor, 'event-day copilot', eventId);
      throw new ForbiddenException('Only PMCM or the designated event-day operator can use the copilot');
    }
    const input = buildEventDayCopilotInput(facts, now);
    const digest = digestJson(input);
    const cached = this.copilotCache.get(eventId);
    if (cached && cached.digest === digest && now.getTime() - cached.at < COPILOT_REUSE_MS) return cached.advice;
    const result = await this.aiGateway.run('event-day.copilot', input);
    if (result.outcome !== 'completed') throw aiRunFailureToHttpException(result);
    const advice = { ...eventDayCopilotResultSchema.parse(result.output), generatedAt: now.toISOString() };
    this.copilotCache.set(eventId, { digest, at: now.getTime(), advice });
    return advice;
  }

  /** FR-AI-05: PMCM asks about one event. The assistant has no tools; suggested steps are text PMCM may act on. */
  async askOperationsAssistant(eventId: string, ask: AskOperationsAssistantInput, verifiedActor: PrismVerifiedEventActor, now = new Date()) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'operations assistant', eventId);
    const facts = await this.references.findOperationsAssistantFacts(eventId, now);
    if (!facts) throw new NotFoundException('Event not found');
    const result = await this.aiGateway.run('operations.assistant', buildOperationsAssistantInput(facts, ask, now));
    if (result.outcome !== 'completed') throw aiRunFailureToHttpException(result);
    return operationsAssistantResultSchema.parse(result.output);
  }

  async eventIntelligence(eventId: string, verifiedActor: PrismVerifiedEventActor) {
    const result = await this.aiGateway.run('event.intelligence', buildEventIntelligenceInput(await this.facts(eventId, verifiedActor, 'event intelligence report')));
    if (result.outcome !== 'completed') throw aiRunFailureToHttpException(result);
    return eventIntelligenceResultSchema.parse(result.output);
  }
}
