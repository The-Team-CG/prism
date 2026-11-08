import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { recordEventDecisionSchema, resolveVenueConfirmationSchema, type RecordEventDecisionInput, type PrismVerifiedEventActor, type ResolveVenueConfirmationInput } from '@prism/types';
import { zodBody } from '@prism/kernel/shared';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { EventDecisionService } from '../../application/decisions/event-decision.service';

@Controller('events/:eventId/decisions')
@UseGuards(EventSessionGuard)
export class EventDecisionController {
  constructor(private readonly service: EventDecisionService, private readonly access: EventAccessPolicyService) {}

  @Get()
  list(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.list(eventId, this.access.resolveActor({}, verified));
  }

  @Get('cancellation-summary')
  cancellationSummary(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.cancellationSummary(eventId, this.access.resolveActor({}, verified));
  }

  @Get('venue-confirmations')
  venueConfirmations(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.venueConfirmations(eventId, this.access.resolveActor({}, verified));
  }

  @Post('venue-confirmations/:taskId/resolve')
  resolveVenueConfirmation(@Param('eventId') eventId: string, @Param('taskId') taskId: string, @Body(zodBody(resolveVenueConfirmationSchema)) input: ResolveVenueConfirmationInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.resolveVenueConfirmation(eventId, taskId, input, this.access.resolveActor({}, verified));
  }

  @Post()
  decide(@Param('eventId') eventId: string, @Body(zodBody(recordEventDecisionSchema)) input: RecordEventDecisionInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.decide(eventId, input, this.access.resolveActor({}, verified));
  }
}
