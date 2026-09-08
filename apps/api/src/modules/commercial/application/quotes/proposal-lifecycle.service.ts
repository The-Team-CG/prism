import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor, writeAudit } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { CreateCostEstimateInput, IssueProposalVersionInput, PrismCostEstimate, PrismProposalVersion } from '@prism/types';
import { randomUUID } from 'node:crypto';

export const PROPOSAL_LIFECYCLE_POLICY = {
  issuedVersionsImmutable: true,
  versionNumbering: 'monotonic_per_event',
  revisionMode: 'supersede_prior_retain_history',
  revisionsAllowed: 'event_unlocked_before_event_day',
  clientNegativeDecisionReasonRequired: true,
} as const;

@Injectable()
export class ProposalLifecycleService {
  constructor(private readonly prisma: PrismaService, private readonly access: EventAccessPolicyService, @Inject(AUDIT_WRITER) private readonly audit: AuditWriter) {}

  async createCostEstimate(eventId: string, input: CreateCostEstimateInput, actor: ResolvedEventOpsActor): Promise<PrismCostEstimate> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'cost estimate', eventId);
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.opsEvent.findUnique({ where: { id: eventId } });
      if (!event) throw new NotFoundException('Event not found');
      await this.access.requireCanReadEvent(actor, event, 'cost estimate');
      if (event.archived || event.clientPortalStatus === 'locked') throw new BadRequestException('Cost estimates require an unlocked event');
      const totalAmount = input.lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unitAmount), 0);
      const estimate = await tx.opsCostEstimate.create({ data: {
        id: `ce_${randomUUID()}`, eventId, budgetAmount: input.budgetAmount, totalAmount, notes: input.notes,
        lines: { create: input.lines.map((line) => ({ id: `cel_${randomUUID()}`, category: line.category, description: line.description, quantity: line.quantity, unitAmount: line.unitAmount, totalAmount: Math.round(line.quantity * line.unitAmount), sourceLineId: line.sourceLineId ?? null })) },
      }, include: { lines: true } });
      await writeAudit(this.audit, eventId, actor.email ?? actor.name, 'Created cost estimate', { actorRole: actor.role, actionType: 'create', category: 'billing', affectedType: 'cost_estimate', affectedId: estimate.id, metadata: { budgetAmount: input.budgetAmount, totalAmount, alignment: totalAmount <= input.budgetAmount ? 'within_budget' : 'over_budget', reusedEstimateId: input.reuseEstimateId ?? null } }, { prisma: tx, correlationId: estimate.id, actorId: actor.id });
      return this.mapEstimate(estimate);
    }, { isolationLevel: 'Serializable' });
  }

  async issueProposalVersion(eventId: string, input: IssueProposalVersionInput, actor: ResolvedEventOpsActor): Promise<PrismProposalVersion> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'issue proposal', eventId);
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.opsEvent.findUnique({ where: { id: eventId } });
      if (!event) throw new NotFoundException('Event not found');
      await this.access.requireCanReadEvent(actor, event, 'issue proposal');
      if (event.archived || event.clientPortalStatus === 'locked' || event.eventDate <= new Date()) throw new BadRequestException('Proposals can only be issued before event day while the event is unlocked');
      const estimate = await tx.opsCostEstimate.findFirst({ where: { id: input.costEstimateId, eventId }, include: { lines: true } });
      if (!estimate) throw new BadRequestException('Cost estimate is not available for this event');
      const previous = await tx.opsProposalVersion.findFirst({ where: { eventId }, orderBy: { versionNumber: 'desc' } });
      const versionNumber = (previous?.versionNumber ?? 0) + 1;
      if (previous) await tx.opsProposalVersion.update({ where: { id: previous.id }, data: { status: 'superseded' } });
      const version = await tx.opsProposalVersion.create({ data: { id: `proposal_${randomUUID()}`, eventId, costEstimateId: estimate.id, versionNumber, title: input.title, summary: input.summary, totalAmount: estimate.totalAmount, revisionNote: input.revisionNote, status: 'issued', issuedAt: new Date() } });
      await writeAudit(this.audit, eventId, actor.email ?? actor.name, 'Issued proposal version', { actorRole: actor.role, actionType: 'create', category: 'events', affectedType: 'proposal_version', affectedId: version.id, metadata: { versionNumber, costEstimateId: estimate.id, totalAmount: estimate.totalAmount, policy: PROPOSAL_LIFECYCLE_POLICY } }, { prisma: tx, correlationId: version.id, actorId: actor.id });
      return version;
    }, { isolationLevel: 'Serializable' });
  }

  private mapEstimate(value: any): PrismCostEstimate { return { id: value.id, eventId: value.eventId, budgetAmount: value.budgetAmount, totalAmount: value.totalAmount, alignment: value.totalAmount <= value.budgetAmount ? 'within_budget' : 'over_budget', status: value.status, notes: value.notes, createdAt: value.createdAt.toISOString(), lines: value.lines.map((line: any) => ({ id: line.id, category: line.category, description: line.description, quantity: Number(line.quantity), unitAmount: line.unitAmount, totalAmount: line.totalAmount, sourceLineId: line.sourceLineId })) }; }
}
