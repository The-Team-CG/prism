import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { ReviewEventProposalInput } from '@prism/types';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
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

    const current = {
      status: event.proposalClientStatus,
      revisionCount: event.proposalRevisionCount,
    };
    let next: ReturnType<typeof nextProposalClientReview>;
    try {
      next = nextProposalClientReview(current, input.action);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Proposal review is not allowed');
    }

    const updated = await this.prisma.opsEvent.update({
      where: { id: eventId },
      data: {
        proposalClientStatus: next.status,
        proposalRevisionCount: next.revisionCount,
        proposalReviewedAt: new Date(),
        proposalReviewedBy: actor.email ?? actor.name,
      },
      include: { floorPlanDrafts: true },
    });
    return mapOnboardingEvent(updated);
  }
}
