import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { FLOORPLAN_READER } from '../../../floorplan/contracts/floorplan.tokens';
import type { FloorplanReader } from '../../../floorplan/contracts/floorplan-reader.port';
import { GUEST_READER } from '../../../operations/contracts/guest-ops.tokens';
import type { GuestReader } from '../../../operations/contracts/guest-reader.port';
import { mapClosureEvent, mapEventInsight, mapPostEventDocument } from '../../application/closure/closure.mappers';
import { EventClosureService } from '../../application/closure/event-closure.service';
import {
  archiveSearchFiltersSchema,
  archiveEventSchema,
  type ArchiveEventInput,
  type ArchiveSearchFilters,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { zodBody, zodQuery } from '@prism/kernel/shared';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';

@Controller('events')
export class OpsEventClosureController {
  constructor(
    private readonly eventClosureService: EventClosureService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(GUEST_READER) private readonly guestReader: GuestReader,
    @Inject(FLOORPLAN_READER) private readonly floorplanReader: FloorplanReader,
  ) {}

  @Get('archive')
  @UseGuards(EventSessionGuard)
  searchArchive(
    @Query(zodQuery(archiveSearchFiltersSchema)) filters: ArchiveSearchFilters,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventClosureService.searchArchive(filters, actor);
  }

  @Patch(':eventId/post-event-documents/:documentId/complete')
  @UseGuards(EventSessionGuard)
  async completePostEventDocument(
    @Param('eventId') eventId: string,
    @Param('documentId') documentId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, ["pmcm-admin", "system"], 'post-event document completion', eventId);
    const document = await this.eventClosureService.completePostEventDocument(eventId, documentId, actor);
    return mapPostEventDocument(document);
  }

  @Get(':eventId/close-gates')
  @UseGuards(EventSessionGuard)
  closeGates(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventAccessPolicyService.requireActorRole(actor, ["pmcm-admin", "system"], 'close gates', eventId).then(() =>
      this.eventClosureService.closeGates(eventId));
  }

  @Post(':eventId/archive')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async archiveEvent(@Param('eventId') eventId: string, @Body(zodBody(archiveEventSchema)) dto: ArchiveEventInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, ["pmcm-admin", "system"], 'event archive', eventId);
    const event = await this.eventClosureService.archiveEvent(eventId, { overrideReason: dto.overrideReason, actorName: actor.name, actorRole: actor.role, actorEmail: actor.email, actorId: actor.id });
    return mapClosureEvent(event, { guestReader: this.guestReader, floorplanReader: this.floorplanReader });
  }

  @Get(':eventId/insights')
  @UseGuards(EventSessionGuard)
  async eventInsights(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    const insights = await this.eventClosureService.listEventInsights(eventId, actor);
    return insights.map(mapEventInsight);
  }

  @Post(':eventId/insights/generate')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async generateEventInsights(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    const insight = await this.eventClosureService.generateEventInsights(eventId, actor);
    return mapEventInsight(insight);
  }
}
