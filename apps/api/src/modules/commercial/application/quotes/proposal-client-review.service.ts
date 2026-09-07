import { BadRequestException, ForbiddenException, Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { ReviewEventProposalInput } from '@prism/types';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import type { Prisma } from '@prisma/client';
import { OpsUserRole } from '@prism/kernel/event-core';
import { mapOnboardingEvent } from '@prism/contexts/event-lifecycle';
import {
  isPrimaryClientContact,
  nextProposalClientReview,
} from '../../domain/proposal-client-review.policy';

@Injectable()
export class ProposalClientReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  private async loadReviewContext(tx: Prisma.TransactionClient, eventId: string, actor: ResolvedEventOpsActor) {
    const event = await tx.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: true } });
    if (!event) throw new NotFoundException('Event not found');
    if (!isPrimaryClientContact(actor.email, event.inquiry.email)) {
      throw new ForbiddenException('Only the primary client contact can approve or request a proposal revision');
    }
    const proposal = await tx.opsDocument.findFirst({
      where: { eventId, status: 'issued', type: { in: ['proposal', 'ce_proposal', 'briefing_proposal'] } },
      orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    if (!proposal) throw new BadRequestException('No issued proposal is available for review');
    return { event, proposal };
  }

  private async replayIfPresent(
    tx: Prisma.TransactionClient,
    eventId: string,
    reviewKey: string,
    input: ReviewEventProposalInput,
    actor: ResolvedEventOpsActor,
    proposalId: string,
  ) {
    const prior = await tx.opsAuditLog.findFirst({
      where: { eventId, affectedType: 'proposal_client_review', affectedId: reviewKey },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (!prior) return null;
    const metadata = prior.metadata as { action?: string; revisionNote?: string | null; actorEmail?: string | null; actorId?: string | null; proposalDocumentId?: string };
    const samePayload = metadata.action === input.action &&
      (metadata.revisionNote ?? null) === (input.revisionNote ?? null) &&
      (metadata.actorEmail ?? null) === (actor.email ?? null) &&
      (metadata.actorId ?? null) === (actor.id ?? null) &&
      metadata.proposalDocumentId === proposalId;
    if (!samePayload) throw new BadRequestException('Idempotency key was reused for another proposal decision');
    return tx.opsEvent.findUniqueOrThrow({ where: { id: eventId }, include: { floorPlanDrafts: true } });
  }

  async review(eventId: string, input: ReviewEventProposalInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'proposal review', eventId);

    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { proposalRevisionCount: true } });
    if (!event) throw new NotFoundException('Event not found');
    const reviewKey = input.idempotencyKey?.trim() || `proposal-review:${eventId}:${input.action}:${event.proposalRevisionCount}`;

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { event: currentEvent, proposal: issuedProposal } = await this.loadReviewContext(tx, eventId, actor);
      const replay = await this.replayIfPresent(tx, eventId, reviewKey, input, actor, issuedProposal.id);
      if (replay) return replay;

      if (currentEvent.clientPortalStatus !== 'unlocked') throw new BadRequestException('Client proposal review is locked');
      if (currentEvent.archived) throw new BadRequestException('Archived events cannot receive proposal decisions');

      const priorReviews = await tx.opsAuditLog.findMany({
        where: { eventId, affectedType: 'proposal_client_review' },
        select: { metadata: true },
      });
      const alreadyReviewedVersion = priorReviews.some((review) => {
        const metadata = review.metadata as { proposalDocumentId?: string };
        return metadata.proposalDocumentId === issuedProposal.id;
      });
      if (alreadyReviewedVersion) throw new BadRequestException('A newer issued proposal is required for another decision');

      const current = { status: currentEvent.proposalClientStatus, revisionCount: currentEvent.proposalRevisionCount };
      let next: ReturnType<typeof nextProposalClientReview>;
      try {
        next = nextProposalClientReview(current, input.action);
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : 'Proposal review is not allowed');
      }

      const result = await tx.opsEvent.updateMany({
        where: {
          id: eventId,
          proposalClientStatus: { not: 'approved' },
          proposalRevisionCount: currentEvent.proposalRevisionCount,
          clientPortalStatus: 'unlocked',
          archived: false,
        },
        data: {
          proposalClientStatus: next.status,
          proposalRevisionCount: next.revisionCount,
          proposalReviewedAt: new Date(),
          proposalReviewedBy: actor.email ?? actor.name,
        },
      });
      if (result.count !== 1) throw new BadRequestException('Proposal was reviewed concurrently; retry with a new decision');

      await writeAudit(this.auditWriter, eventId, actor.email ?? actor.name ?? 'Client',
        input.action === 'approve' ? 'Client approved proposal' : 'Client requested proposal revision', {
          actorRole: actor.role,
          actorEmail: actor.email ?? undefined,
          actionType: input.action === 'approve' ? 'approve' : 'update',
          category: 'events',
          affectedType: 'proposal_client_review',
          affectedId: reviewKey,
          affectedLabel: currentEvent.eventName,
          metadata: {
            action: input.action,
            revisionNote: input.revisionNote ?? null,
            actorEmail: actor.email ?? null,
            actorId: actor.id ?? null,
            revisionCount: next.revisionCount,
            resultingStatus: next.status,
            proposalDocumentId: issuedProposal.id,
          },
        }, { prisma: tx, correlationId: reviewKey, actorId: actor.id });

      return tx.opsEvent.findUniqueOrThrow({ where: { id: eventId }, include: { floorPlanDrafts: true } });
    });
    return mapOnboardingEvent(updated);
  }
}
