import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  clientMessageDraftRequestSchema,
  sendClientMessageSchema,
  type ClientMessageDraftRequest,
  type SendClientMessageInput,
  inquiryTriageRequestSchema,
  proposalDraftRequestSchema,
  type InquiryTriageRequest,
  type PrismVerifiedEventActor,
  type ProposalDraftRequest,
} from '@prism/types';
import { InquiryTriageService } from '../../application/ai-governance/inquiry-triage.service';
import { ProposalDraftService } from '../../application/ai-governance/proposal-draft.service';
import { ClientMessageDraftService } from '../../application/ai-governance/client-message-draft.service';

@Controller('inquiry-triage')
@UseGuards(EventSessionGuard)
export class InquiryTriageController {
  constructor(private readonly inquiryTriageService: InquiryTriageService) {}

  @Get(':inquiryId')
  latest(@Param('inquiryId') inquiryId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.inquiryTriageService.latest(inquiryId, verifiedActor);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  run(
    @Body(zodBody(inquiryTriageRequestSchema)) request: InquiryTriageRequest,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.inquiryTriageService.run(request, verifiedActor);
  }
}

@Controller('proposal-drafts')
@UseGuards(EventSessionGuard)
export class ProposalDraftsController {
  constructor(private readonly proposalDraftService: ProposalDraftService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  draft(
    @Body(zodBody(proposalDraftRequestSchema)) request: ProposalDraftRequest,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.proposalDraftService.draft(request, verifiedActor);
  }
}

@Controller()
@UseGuards(EventSessionGuard)
export class ClientMessageDraftsController {
  constructor(private readonly clientMessageDraftService: ClientMessageDraftService) {}

  @Get('events/:eventId/client-message-triggers')
  triggers(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.clientMessageDraftService.triggers(eventId, verifiedActor);
  }

  @Post('client-message-drafts')
  @HttpCode(HttpStatus.OK)
  draft(@Body(zodBody(clientMessageDraftRequestSchema)) request: ClientMessageDraftRequest, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.clientMessageDraftService.draft(request, verifiedActor);
  }

  @Post('client-message-drafts/send')
  @HttpCode(HttpStatus.CREATED)
  send(@Body(zodBody(sendClientMessageSchema)) input: SendClientMessageInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.clientMessageDraftService.send(input, verifiedActor);
  }
}
