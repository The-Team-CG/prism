import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { FLOORPLAN_READER, type FloorplanReader } from '@prism/contexts/floorplan';
import { GUEST_READER, type GuestReader } from '@prism/contexts/operations';
import { ArchiveEventDto, ClosureActorDto } from './closure.dto';
import { mapClosureEvent, mapEventInsight, mapPostEventDocument } from '../../application/closure/closure.mappers';
import { EventClosureService } from '../../application/closure/event-closure.service';

@Controller('events')
export class OpsEventClosureController {
  constructor(
    private readonly eventClosureService: EventClosureService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(GUEST_READER) private readonly guestReader: GuestReader,
    @Inject(FLOORPLAN_READER) private readonly floorplanReader: FloorplanReader,
  ) {}

  @Patch(':eventId/post-event-documents/:documentId/complete')
  async completePostEventDocument(
    @Param('eventId') eventId: string,
    @Param('documentId') documentId: string,
  ) {
    const document = await this.eventClosureService.completePostEventDocument(eventId, documentId);
    return mapPostEventDocument(document);
  }

  @Get(':eventId/close-gates')
  closeGates(@Param('eventId') eventId: string) {
    return this.eventClosureService.closeGates(eventId);
  }

  @Post(':eventId/archive')
  @HttpCode(HttpStatus.OK)
  async archiveEvent(@Param('eventId') eventId: string, @Body() dto: ArchiveEventDto = {}) {
    const event = await this.eventClosureService.archiveEvent(eventId, dto);
    return mapClosureEvent(event, { guestReader: this.guestReader, floorplanReader: this.floorplanReader });
  }

  @Get(':eventId/insights')
  async eventInsights(@Param('eventId') eventId: string, @Query() actorInput: ClosureActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    const insights = await this.eventClosureService.listEventInsights(eventId, actor);
    return insights.map(mapEventInsight);
  }

  @Post(':eventId/insights/generate')
  @HttpCode(HttpStatus.CREATED)
  async generateEventInsights(@Param('eventId') eventId: string, @Query() actorInput: ClosureActorDto = {}) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    const insight = await this.eventClosureService.generateEventInsights(eventId, actor);
    return mapEventInsight(insight);
  }
}
