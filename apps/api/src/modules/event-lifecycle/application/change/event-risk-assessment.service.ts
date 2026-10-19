import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismEventRiskAssessment, PrismEventRiskAssessmentRevision, PrismEventRiskView, RiskLevel, RecordEventRiskAssessmentInput } from '@prism/types';

export const RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high', 'critical'];
const RISK_LEVEL_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

/**
 * Suggested event risk level = the highest severity among the event's OPEN compliance risks.
 * Mapping: critical -> critical, high -> high, medium -> medium, low -> low, and no open risks -> low.
 * A severity outside the four known levels counts as medium, so an unclassified open risk never reads as low.
 */
export function suggestRiskLevel(openSeverities: readonly string[]): RiskLevel {
  return openSeverities.reduce<RiskLevel>((highest, severity) => {
    const level = normalizeSeverity(severity);
    return RISK_LEVEL_RANK[level] > RISK_LEVEL_RANK[highest] ? level : highest;
  }, 'low');
}

export function countOpenRisksByLevel(openSeverities: readonly string[]): Record<RiskLevel, number> {
  const counts: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const severity of openSeverities) counts[normalizeSeverity(severity)] += 1;
  return counts;
}

function normalizeSeverity(severity: string): RiskLevel {
  return (RISK_LEVELS as readonly string[]).includes(severity) ? severity as RiskLevel : 'medium';
}

/** Lowering the recorded level (for example critical to medium) needs a stated reason; raising or repeating it does not. */
export function isLoweringRiskLevel(previous: RiskLevel | null, next: RiskLevel): boolean {
  return previous !== null && RISK_LEVEL_RANK[next] < RISK_LEVEL_RANK[previous];
}

type RiskRevisionRow = {
  id: string;
  revision: number;
  level: string;
  previousLevel: string | null;
  suggestedLevel: string;
  summary: string;
  mitigations: string;
  reason: string;
  assessedBy: string;
  assessedAt: Date;
};

function mapRevision(row: RiskRevisionRow): PrismEventRiskAssessmentRevision {
  return {
    id: row.id,
    revision: row.revision,
    level: row.level as RiskLevel,
    previousLevel: row.previousLevel as RiskLevel | null,
    suggestedLevel: row.suggestedLevel as RiskLevel,
    summary: row.summary,
    mitigations: row.mitigations,
    reason: row.reason,
    assessedBy: row.assessedBy,
    assessedAt: row.assessedAt.toISOString(),
  };
}

@Injectable()
export class EventRiskAssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter,
  ) {}

  // Risk levels and the suggestion are PMCM-internal: clients, suppliers, coordinators, and guests never reach this service.
  private async requireOperator(actor: ResolvedEventOpsActor, eventId: string, resource: string) {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], resource, eventId);
  }

  async getAssessment(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismEventRiskView> {
    await this.requireOperator(actor, eventId, 'event risk assessment');
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) throw new NotFoundException('Event not found');
    return this.loadView(this.prisma, eventId);
  }

  /**
   * Records a new revision of the authoritative level. The caller's `expectedRevision` must match the stored revision,
   * and the revision row is written conditionally, so two PMCM users cannot both record the same revision.
   */
  async recordAssessment(eventId: string, input: RecordEventRiskAssessmentInput, actor: ResolvedEventOpsActor): Promise<PrismEventRiskView> {
    await this.requireOperator(actor, eventId, 'event risk assessment');
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, archived: true } });
      if (!event) throw new NotFoundException('Event not found');
      if (event.archived) throw new BadRequestException('Archived events cannot record a risk assessment');

      const current = await tx.opsEventRiskAssessment.findUnique({ where: { eventId } });
      const currentRevision = current?.revision ?? 0;
      if (input.expectedRevision !== currentRevision) {
        throw new ConflictException('The risk assessment changed after it was loaded; reload it before recording a new level');
      }
      const previousLevel = current ? current.level as RiskLevel : null;
      const reason = input.reason?.trim() ?? '';
      if (isLoweringRiskLevel(previousLevel, input.level) && !reason) {
        throw new BadRequestException('A reason is required when lowering the event risk level');
      }

      const openRisks = await tx.opsComplianceRisk.findMany({ where: { eventId, status: 'open' }, select: { severity: true } });
      const suggestedLevel = suggestRiskLevel(openRisks.map((risk) => risk.severity));
      const revision = currentRevision + 1;
      const assessedAt = new Date();
      const mitigations = input.mitigations?.trim() ?? '';
      const summary = input.summary.trim();
      const assessmentFields = { level: input.level, summary, mitigations, revision, assessedBy: actor.name, assessedById: actor.id ?? null, assessedAt };

      let assessmentId = current?.id;
      if (current) {
        const updated = await tx.opsEventRiskAssessment.updateMany({ where: { id: current.id, eventId, revision: currentRevision }, data: assessmentFields });
        if (updated.count !== 1) throw new ConflictException('The risk assessment changed while it was being recorded; reload it and try again');
      } else {
        assessmentId = `risk_assessment_${randomUUID()}`;
        await tx.opsEventRiskAssessment.create({ data: { id: assessmentId, eventId, ...assessmentFields } });
      }
      await tx.opsEventRiskAssessmentHistory.create({
        data: { id: `risk_revision_${randomUUID()}`, assessmentId: assessmentId!, revision, level: input.level, previousLevel, suggestedLevel, summary, mitigations, reason, assessedBy: actor.name, assessedById: actor.id ?? null, assessedAt },
      });
      await writeAudit(this.audit, eventId, actor.name, 'Recorded event risk level', { actorRole: actor.role, actionType: 'update', category: 'events', affectedType: 'event_risk_assessment', affectedId: assessmentId, metadata: { revision, previousLevel, level: input.level, suggestedLevel, reason } }, { prisma: tx, correlationId: eventId, actorId: actor.id });
      return this.loadView(tx, eventId);
    }, { isolationLevel: 'Serializable' });
  }

  private async loadView(prisma: PrismaService | Prisma.TransactionClient, eventId: string): Promise<PrismEventRiskView> {
    const [openRisks, assessment] = await Promise.all([
      prisma.opsComplianceRisk.findMany({ where: { eventId, status: 'open' }, select: { severity: true } }),
      prisma.opsEventRiskAssessment.findUnique({ where: { eventId }, include: { history: { orderBy: { revision: 'desc' } } } }),
    ]);
    const severities = openRisks.map((risk) => risk.severity);
    const current: PrismEventRiskAssessment | null = assessment
      ? {
        eventId,
        level: assessment.level as RiskLevel,
        summary: assessment.summary,
        mitigations: assessment.mitigations,
        revision: assessment.revision,
        assessedBy: assessment.assessedBy,
        assessedAt: assessment.assessedAt.toISOString(),
      }
      : null;
    return {
      eventId,
      suggestedLevel: suggestRiskLevel(severities),
      openRiskCounts: countOpenRisksByLevel(severities),
      assessment: current,
      history: (assessment?.history ?? []).map(mapRevision),
    };
  }
}
