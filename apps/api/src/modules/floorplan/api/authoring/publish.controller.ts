import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismVerifiedEventActor } from '@prism/types';
import { PublishService } from '../../application/authoring/publish.service';

@Controller('publish')
export class PublishController {
  constructor(private readonly publishService: PublishService, private readonly access: EventAccessPolicyService) {}

  @Post('events/:eventId')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async publishEvent(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'layout publishing', eventId);
    return this.publishService.publishEvent(eventId);
  }

  @Get(':slug')
  @UseGuards(EventSessionGuard)
  async getSnapshot(@Param('slug') slug: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'published layout inventory');
    return this.publishService.getPublishedLayout(slug);
  }
}
