import { BadRequestException, ForbiddenException, Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { PrismDocumentReference, ReviewEventProposalInput } from '@prism/types';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import type { Prisma } from '@prisma/client';
import { OpsUserRole } from '@prism/kernel/event-core';
import { DOCUMENT_VAULT, mapOnboardingEvent, type DocumentVault } from '@prism/contexts/event-lifecycle';
import { findFloorPlanDraftsByEvent } from '@prism/contexts/floorplan/event-drafts';
import { PROPOSAL_REVIEW_OWNER, type ProposalReviewOwner } from '@prism/contexts/event-lifecycle';
import { COMMERCIAL_FACTS_READER, type CommercialFactsReader } from '@prism/contexts/read-models/commercial-facts-reader';
import {
  isPrimaryClientContact,
  nextProposalClientReview,
} from '../../domain/proposal-client-review.policy';

// Floorplan owns drafts; the event only carries ids, so the drafts are read through Floorplan's reader.
@Injectable()
export class ProposalClientReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(DOCUMENT_VAULT) private readonly documentVault: DocumentVault,
    @Inject(PROPOSAL_REVIEW_OWNER) private readonly proposalReviewOwner: ProposalReviewOwner,
    @Inject(COMMERCIAL_FACTS_READER) private readonly commercialFacts: CommercialFactsReader,
  ) {}

  private async loadEventWithDrafts(tx: Prisma.TransactionClient, eventId: string) {
    const event = await this.commercialFacts.findProposalReviewEvent(eventId, tx);
    if (!event) throw new NotFoundException('Event not found');
    const drafts = await findFloorPlanDraftsByEvent(tx, [eventId]);
    return { ...event, floorPlanDrafts: drafts.get(eventId) ?? [] };
  }

  private async loadReviewContext(tx: Prisma.TransactionClient, eventId: string, actor: ResolvedEventOpsActor) {
    const event = await this.commercialFacts.findProposalReviewEvent(eventId, tx);
    if (!event) throw new NotFoundException('Event not found');
    if (!isPrimaryClientContact(actor.email, event.inquiry.email)) {
      throw new ForbiddenException('Only the primary client contact can approve or request a proposal revision');
    }
    let proposal: PrismDocumentReference;
    try {
      proposal = await this.documentVault.findEligibleReference(
        { eventId, purpose: 'client_proposal_review' },
        { prisma: tx, correlationId: `proposal-review:${eventId}`, actorId: actor.id },
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw new BadRequestException('No issued proposal is available for review');
      throw error;
    }
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
    const prior = await this.commercialFacts.findProposalReviewAudit(eventId, reviewKey, tx);
    if (!prior) return null;
    const metadata = prior.metadata as { action?: string; revisionNote?: string | null; actorEmail?: string | null; actorId?: string | null; proposalDocumentId?: string };
    const samePayload = metadata.action === input.action &&
      (metadata.revisionNote ?? null) === (input.revisionNote ?? null) &&
      (metadata.actorEmail ?? null) === (actor.email ?? null) &&
      (metadata.actorId ?? null) === (actor.id ?? null) &&
      metadata.proposalDocumentId === proposalId;
    if (!samePayload) throw new BadRequestException('Idempotency key was reused for another proposal decision');
    return this.loadEventWithDrafts(tx, eventId);
  }

  async review(eventId: string, input: ReviewEventProposalInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Client], 'proposal review', eventId);

    const event = await this.commercialFacts.findProposalReviewEvent(eventId);
    if (!event) throw new NotFoundException('Event not found');
    const reviewKey = input.idempotencyKey?.trim() || `proposal-review:${eventId}:${input.action}:${event.proposalRevisionCount}`;

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { event: currentEvent, proposal: issuedProposal } = await this.loadReviewContext(tx, eventId, actor);
      const replay = await this.replayIfPresent(tx, eventId, reviewKey, input, actor, issuedProposal.id);
      if (replay) return replay;

      if (currentEvent.clientPortalStatus !== 'unlocked') throw new BadRequestException('Client proposal review is locked');
      if (currentEvent.archived) throw new BadRequestException('Archived events cannot receive proposal decisions');

      const priorReviews = await this.commercialFacts.listProposalReviewAudits(eventId, tx);
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

      const updatedCount = await this.proposalReviewOwner.updateProposalReview({
        eventId,
        expectedRevisionCount: currentEvent.proposalRevisionCount,
        nextStatus: next.status,
        nextRevisionCount: next.revisionCount,
        reviewedAt: new Date(),
        reviewedBy: actor.email ?? actor.name,
      }, { prisma: tx, correlationId: reviewKey, actorId: actor.id });
      if (updatedCount !== 1) throw new BadRequestException('Proposal was reviewed concurrently; retry with a new decision');

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

      return this.loadEventWithDrafts(tx, eventId);
    });
    return mapOnboardingEvent(updated);
  }
}
