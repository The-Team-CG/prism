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

  async review(eventId: string, input: ReviewEventProposalInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'proposal review', eventId);

    const event = await this.prisma.opsEvent.findUnique({
      where: { id: eventId },
      include: { inquiry: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    if (!isPrimaryClientContact(actor.email, event.inquiry.email)) {
      throw new ForbiddenException('Only the primary client contact can approve or request a proposal revision');
    }

    const issuedProposal = await this.prisma.opsDocument.findFirst({
      where: { eventId, status: 'issued', type: { in: ['proposal', 'ce_proposal', 'briefing_proposal'] } },
      select: { id: true },
    });
    if (!issuedProposal) throw new BadRequestException('No issued proposal is available for review');

    const reviewKey = input.idempotencyKey?.trim() || `proposal-review:${eventId}:${input.action}:${event.proposalRevisionCount}`;

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const prior = await tx.opsAuditLog.findFirst({
        where: { eventId, affectedType: 'proposal_client_review', affectedId: reviewKey },
        orderBy: { createdAt: 'desc' },
      });
      if (prior) {
        const metadata = prior.metadata as { action?: string; revisionNote?: string | null; actorEmail?: string | null; actorId?: string | null; proposalDocumentId?: string };
        if (
          metadata.action !== input.action ||
          (metadata.revisionNote ?? null) !== (input.revisionNote ?? null) ||
          (metadata.actorEmail ?? null) !== (actor.email ?? null) ||
          (metadata.actorId ?? null) !== (actor.id ?? null) ||
          metadata.proposalDocumentId !== issuedProposal.id
        ) throw new BadRequestException('Idempotency key was reused for another proposal decision');
        return tx.opsEvent.findUniqueOrThrow({ where: { id: eventId }, include: { floorPlanDrafts: true } });
      }

      if (event.clientPortalStatus !== 'unlocked') throw new BadRequestException('Client proposal review is locked');
      if (event.archived) throw new BadRequestException('Archived events cannot receive proposal decisions');

      const current = { status: event.proposalClientStatus, revisionCount: event.proposalRevisionCount };
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
          proposalRevisionCount: event.proposalRevisionCount,
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
          affectedLabel: event.eventName,
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
