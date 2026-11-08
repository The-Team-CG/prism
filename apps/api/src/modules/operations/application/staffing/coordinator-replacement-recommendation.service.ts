import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsCoordinatorReplacementRecommendation } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { replaceCoordinatorAssignmentSchema, type DecideCoordinatorReplacementInput, type PrismCoordinatorReplacementCandidate, type PrismCoordinatorReplacementRecommendation } from '@prism/types';
import { CoordinatorAssignmentCommandService } from './coordinator-assignment-command.service';

function mapRecommendation(row: OpsCoordinatorReplacementRecommendation): PrismCoordinatorReplacementRecommendation {
  return {
    id: row.id, eventId: row.eventId, withdrawnAssignmentId: row.withdrawnAssignmentId, withdrawnCoordinatorName: row.withdrawnCoordinatorName,
    role: row.role, hoursToEvent: row.hoursToEvent, riskLevel: row.riskLevel === 'critical' ? 'critical' : 'high', riskSummary: row.riskSummary,
    candidates: Array.isArray(row.candidates) ? row.candidates as unknown as PrismCoordinatorReplacementCandidate[] : [],
    draftMessage: row.draftMessage, status: row.status as PrismCoordinatorReplacementRecommendation['status'],
    selectedCoordinatorId: row.selectedCoordinatorId, reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(),
  };
}

/** FR-AI-04 PARE coordinator mode: PMCM reviews the package; approving assigns the chosen coordinator through the normal replacement command. */
@Injectable()
export class CoordinatorReplacementRecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    private readonly commands: CoordinatorAssignmentCommandService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  async list(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismCoordinatorReplacementRecommendation[]> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'PARE coordinator recommendations', eventId);
    const rows = await this.prisma.opsCoordinatorReplacementRecommendation.findMany({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50 });
    return rows.map(mapRecommendation);
  }

  async decide(eventId: string, recommendationId: string, input: DecideCoordinatorReplacementInput, actor: ResolvedEventOpsActor): Promise<PrismCoordinatorReplacementRecommendation> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'PARE coordinator decision', eventId);
    const row = await this.requirePending(eventId, recommendationId);
    const candidate = this.chosenCandidate(row, input);
    if (candidate) {
      await this.commands.replaceCoordinator(eventId, row.withdrawnAssignmentId, replaceCoordinatorAssignmentSchema.parse({
        replacementCoordinatorId: candidate.coordinatorId, replacementCoordinatorName: candidate.name, role: row.role,
        reason: input.note?.trim() || `PARE recommendation approved after ${row.withdrawnCoordinatorName} withdrew`,
      }), actor);
    }
    const updated = await this.prisma.opsCoordinatorReplacementRecommendation.update({ where: { id: row.id }, data: {
      status: candidate ? 'approved' : 'rejected', selectedCoordinatorId: candidate?.coordinatorId ?? null, reviewedBy: actor.name, reviewedAt: new Date(),
    } });
    await writeAudit(this.auditWriter, eventId, actor.name, candidate ? `Approved PARE coordinator replacement: ${candidate.name}` : 'Rejected PARE coordinator recommendation', {
      actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Events,
      actionType: candidate ? AuditActionType.Approve : AuditActionType.Update,
      affectedType: 'coordinator_replacement_recommendation', affectedId: row.id, metadata: { note: input.note ?? '', actorId: actor.id ?? null },
    });
    return mapRecommendation(updated);
  }

  private async requirePending(eventId: string, recommendationId: string) {
    const row = await this.prisma.opsCoordinatorReplacementRecommendation.findFirst({ where: { id: recommendationId, eventId } });
    if (!row) throw new NotFoundException('Recommendation not found');
    if (row.status !== 'pending') throw new BadRequestException('This recommendation was already decided');
    return row;
  }

  /** Approval must name one of the recommended coordinators; a rejection names none. */
  private chosenCandidate(row: OpsCoordinatorReplacementRecommendation, input: DecideCoordinatorReplacementInput) {
    if (input.action !== 'approve') return undefined;
    const candidate = mapRecommendation(row).candidates.find((item) => item.coordinatorId === input.coordinatorId);
    if (!candidate) throw new BadRequestException('Choose one of the recommended coordinators');
    return candidate;
  }
}
