import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { createCostEstimateSchema, createProposalCommentSchema, issueProposalVersionSchema, type CreateCostEstimateInput, type CreateProposalCommentInput, type IssueProposalVersionInput, type PrismVerifiedEventActor } from '@prism/types';
import { zodBody } from '@prism/kernel/shared';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { ProposalLifecycleService } from '../../application/quotes/proposal-lifecycle.service';
import { ProposalCommentsService } from '../../application/quotes/proposal-comments.service';
import { ProposalCanvaExportService } from '../../application/quotes/proposal-canva-export.service';

@Controller('events')
export class ProposalLifecycleController {
  constructor(
    private readonly service: ProposalLifecycleService,
    private readonly comments: ProposalCommentsService,
    private readonly access: EventAccessPolicyService,
    private readonly canva: ProposalCanvaExportService,
  ) {}

  /** FR-59: the latest issued proposal, filled into PMCM's Canva proposal template. */
  @Post(':eventId/proposal/canva')
  @UseGuards(EventSessionGuard)
  sendToCanva(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.canva.exportLatest(eventId, this.access.resolveActor({}, verified));
  }

  @Get(':eventId/proposal/comments')
  @UseGuards(EventSessionGuard)
  listComments(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.comments.list(eventId, this.access.resolveActor({}, verified));
  }

  @Post(':eventId/proposal/comments')
  @UseGuards(EventSessionGuard)
  createComment(@Param('eventId') eventId: string, @Body(zodBody(createProposalCommentSchema)) input: CreateProposalCommentInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.comments.create(eventId, input, this.access.resolveActor({}, verified));
  }

  @Get(':eventId/cost-estimates/supplier-quote-lines')
  @UseGuards(EventSessionGuard)
  selectedQuoteLines(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.selectedQuoteLines(eventId, this.access.resolveActor({}, verified));
  }

  @Get(':eventId/cost-estimates/previous')
  @UseGuards(EventSessionGuard)
  previousCostEstimates(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.previousCostEstimates(eventId, this.access.resolveActor({}, verified));
  }

  @Post(':eventId/cost-estimates')
  @UseGuards(EventSessionGuard)
  createEstimate(@Param('eventId') eventId: string, @Body(zodBody(createCostEstimateSchema)) input: CreateCostEstimateInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.createCostEstimate(eventId, input, this.access.resolveActor({}, verified));
  }

  @Post(':eventId/proposal/versions')
  @UseGuards(EventSessionGuard)
  issueProposal(@Param('eventId') eventId: string, @Body(zodBody(issueProposalVersionSchema)) input: IssueProposalVersionInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.issueProposalVersion(eventId, input, this.access.resolveActor({}, verified), verified);
  }

  @Get(':eventId/proposal')
  @UseGuards(EventSessionGuard)
  latestProposal(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.getLatestIssuedProposal(eventId, this.access.resolveActor({}, verified));
  }
}
