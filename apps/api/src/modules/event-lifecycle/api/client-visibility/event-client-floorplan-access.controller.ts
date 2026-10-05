import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { grantSecondaryClientAccessSchema, type GrantSecondaryClientAccessInput, type PrismVerifiedEventActor } from '@prism/types';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventClientFloorplanAccessService } from '../../application/client-visibility/event-client-floorplan-access.service';

@Controller('events')
export class EventClientFloorplanAccessController {
  constructor(
    private readonly eventClientFloorplanAccessService: EventClientFloorplanAccessService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get(':eventId/client-floorplan-access')
  @UseGuards(EventSessionGuard)
  async listAccess(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = await this.authorize(verifiedActor, eventId);
    return this.eventClientFloorplanAccessService.listAccess(eventId, actor);
  }

  @Get(':eventId/client-floorplan-access/candidates')
  @UseGuards(EventSessionGuard)
  async searchCandidates(
    @Param('eventId') eventId: string,
    @Query('query') query: string | undefined,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.authorize(verifiedActor, eventId);
    return this.eventClientFloorplanAccessService.searchCandidates(eventId, query ?? '', actor);
  }

  @Post(':eventId/client-floorplan-access')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async grant(
    @Param('eventId') eventId: string,
    @Body(zodBody(grantSecondaryClientAccessSchema)) input: GrantSecondaryClientAccessInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.authorize(verifiedActor, eventId);
    return this.eventClientFloorplanAccessService.grant(eventId, input.userId, actor);
  }

  @Delete(':eventId/client-floorplan-access/:userId')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async revoke(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.authorize(verifiedActor, eventId);
    return this.eventClientFloorplanAccessService.revoke(eventId, userId, actor);
  }

  private async authorize(verifiedActor: PrismVerifiedEventActor, eventId: string) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'client floorplan access',
      eventId,
    );
    return actor;
  }
}
