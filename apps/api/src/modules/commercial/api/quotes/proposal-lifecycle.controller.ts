import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { createCostEstimateSchema, issueProposalVersionSchema, type CreateCostEstimateInput, type IssueProposalVersionInput, type PrismVerifiedEventActor } from '@prism/types';
import { zodBody } from '@prism/kernel/shared';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { ProposalLifecycleService } from '../../application/quotes/proposal-lifecycle.service';

@Controller('events')
export class ProposalLifecycleController {
  constructor(private readonly service: ProposalLifecycleService, private readonly access: EventAccessPolicyService) {}

  @Post(':eventId/cost-estimates')
  @UseGuards(EventSessionGuard)
  createEstimate(@Param('eventId') eventId: string, @Body(zodBody(createCostEstimateSchema)) input: CreateCostEstimateInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.createCostEstimate(eventId, input, this.access.resolveActor({}, verified));
  }

  @Post(':eventId/proposal/versions')
  @UseGuards(EventSessionGuard)
  issueProposal(@Param('eventId') eventId: string, @Body(zodBody(issueProposalVersionSchema)) input: IssueProposalVersionInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.issueProposalVersion(eventId, input, this.access.resolveActor({}, verified));
  }
}
