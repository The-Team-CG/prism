import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { FLOORPLAN_READER, type FloorplanReader } from '@prism/contexts/floorplan';
import { GUEST_READER, type GuestReader } from '@prism/contexts/operations';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { mapEvent } from '../application/mappers/pmcm-read-model.mappers';
import { EventReadModelsService } from '../application/services/event-read-models.service';

@Controller('events')
export class OpsEventReadsController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(FLOORPLAN_READER) private readonly floorplanReader: FloorplanReader,
    @Inject(GUEST_READER) private readonly guestReader: GuestReader,
  ) {}

  @Get()
  @UseGuards(EventSessionGuard)
  list(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor, @Query('cursor') cursor?: string) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.eventList(actor, this.mappers(), cursor);
  }

  @Get(':eventId')
  @UseGuards(EventSessionGuard)
  detail(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.eventDetail(actor, eventId, this.mappers());
  }

  private mappers() {
    return {
      mapEvent: (event: Parameters<typeof mapEvent>[0]) =>
        mapEvent(event, {
          floorplanReader: this.floorplanReader,
          guestReader: this.guestReader,
        }),
    };
  }
}
