import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { OpsUserRole } from '@prism/kernel/event-core';
import { createEventFromTemplateSchema, type CreateEventFromTemplateInput, type PrismVerifiedEventActor } from '@prism/types';
import { zodBody } from '@prism/kernel/shared';
import { LayoutEventsService } from '../../application/authoring/layout-events.service';

@Controller('layout-events')
export class LayoutEventsController {
  constructor(private readonly eventsService: LayoutEventsService, private readonly access: EventAccessPolicyService) {}

  @Get()
  @UseGuards(EventSessionGuard)
  async list(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'layout event inventory');
    return this.eventsService.listEvents();
  }

  @Post()
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(zodBody(createEventFromTemplateSchema)) dto: CreateEventFromTemplateInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'layout event authoring');
    return this.eventsService.createEventFromTemplate(dto);
  }
}
