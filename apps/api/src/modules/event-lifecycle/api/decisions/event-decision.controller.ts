import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { eventDecisionSchema, type EventDecisionInput, type PrismVerifiedEventActor } from '@prism/types';
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

  @Post()
  decide(@Param('eventId') eventId: string, @Body(zodBody(eventDecisionSchema)) input: EventDecisionInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.decide(eventId, input, this.access.resolveActor({}, verified));
  }
}
