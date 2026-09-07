import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismVerifiedEventActor } from '@prism/types';
import { CreateEventDto } from './create-event.dto';
import { LayoutEventsService } from '../../application/authoring/layout-events.service';

@Controller('layout-events')
export class LayoutEventsController {
  constructor(private readonly eventsService: LayoutEventsService, private readonly access: EventAccessPolicyService) {}

  @Get()
  list() {
    return this.eventsService.listEvents();
  }

  @Post()
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateEventDto, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'layout event authoring');
    return this.eventsService.createEventFromTemplate(dto);
  }
}
