import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { createEventRiskSchema, updateEventRiskSchema, type CreateEventRiskInput, type PrismVerifiedEventActor, type UpdateEventRiskInput } from '@prism/types';
import { EventRiskRegisterService } from '../../application/change/event-risk-register.service';

@Controller('events/:eventId/risks')
@UseGuards(EventSessionGuard)
export class EventRiskRegisterController {
  constructor(private readonly service: EventRiskRegisterService, private readonly access: EventAccessPolicyService) {}

  @Get()
  list(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.list(eventId, this.access.resolveActor({}, verified));
  }

  @Post('standard')
  loadStandard(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.loadStandardRisks(eventId, this.access.resolveActor({}, verified));
  }

  @Post()
  create(@Param('eventId') eventId: string, @Body(zodBody(createEventRiskSchema)) input: CreateEventRiskInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.create(eventId, input, this.access.resolveActor({}, verified));
  }

  @Patch(':riskId')
  update(@Param('eventId') eventId: string, @Param('riskId') riskId: string, @Body(zodBody(updateEventRiskSchema)) input: UpdateEventRiskInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.update(eventId, riskId, input, this.access.resolveActor({}, verified));
  }
}
