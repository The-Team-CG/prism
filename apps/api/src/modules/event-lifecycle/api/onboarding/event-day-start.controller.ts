import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { startEventDaySchema, type PrismVerifiedEventActor } from '@prism/types';
import { EventDayStartService } from '../../application/onboarding/event-day-start.service';

@Controller('events')
@UseGuards(EventSessionGuard)
export class EventDayStartController {
  constructor(private readonly service: EventDayStartService, private readonly access: EventAccessPolicyService) {}

  @Post(':eventId/start-event-day')
  @HttpCode(HttpStatus.OK)
  start(@Param('eventId') eventId: string, @Body(zodBody(startEventDaySchema)) _input: unknown, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.start(eventId, this.access.resolveActor({}, verified));
  }
}
