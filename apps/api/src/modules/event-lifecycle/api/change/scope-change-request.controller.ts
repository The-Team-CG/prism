import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { reviewScopeChangeRequestSchema, submitScopeChangeRequestSchema, type PrismVerifiedEventActor, type ReviewScopeChangeRequestInput, type SubmitScopeChangeRequestInput } from '@prism/types';
import { ScopeChangeRequestService } from '../../application/change/scope-change-request.service';

@Controller('events')
export class ScopeChangeRequestController {
  constructor(private readonly service: ScopeChangeRequestService, private readonly access: EventAccessPolicyService) {}

  @Post(':eventId/scope-changes')
  @UseGuards(EventSessionGuard)
  submit(@Param('eventId') eventId: string, @Body(zodBody(submitScopeChangeRequestSchema)) input: SubmitScopeChangeRequestInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.submit(eventId, input, this.access.resolveActor({}, verified));
  }

  @Get(':eventId/scope-changes')
  @UseGuards(EventSessionGuard)
  listForPmcm(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.listForPmcm(eventId, this.access.resolveActor({}, verified));
  }

  @Post(':eventId/scope-changes/:requestId/withdraw')
  @UseGuards(EventSessionGuard)
  withdraw(@Param('eventId') eventId: string, @Param('requestId') requestId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.withdraw(eventId, requestId, this.access.resolveActor({}, verified));
  }

  @Patch(':eventId/scope-changes/:requestId')
  @UseGuards(EventSessionGuard)
  review(@Param('eventId') eventId: string, @Param('requestId') requestId: string, @Body(zodBody(reviewScopeChangeRequestSchema)) input: ReviewScopeChangeRequestInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.review(eventId, requestId, input, this.access.resolveActor({}, verified));
  }
}
