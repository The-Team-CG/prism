import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import {
  reviewEventProposalSchema,
  type PrismVerifiedEventActor,
  type ReviewEventProposalInput,
} from '@prism/types';
import { zodBody } from '@prism/kernel/shared';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { ProposalClientReviewService } from '../../application/quotes/proposal-client-review.service';

@Controller('events')
export class OpsEventProposalReviewController {
  constructor(
    private readonly proposalClientReviewService: ProposalClientReviewService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Patch(':eventId/proposal/review')
  @UseGuards(EventSessionGuard)
  review(
    @Param('eventId') eventId: string,
    @Body(zodBody(reviewEventProposalSchema)) input: ReviewEventProposalInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.proposalClientReviewService.review(eventId, input, actor);
  }
}
