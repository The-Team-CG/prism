import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { FloorPlanWorkflowService } from '@prism/modules/floorplan';
import { GuestWorkflowService } from '@prism/modules/guest-ops';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/identity-ops';
import type { PrismVerifiedEventActor } from '@prism/types';
import { mapEvent } from '../mappers/pmcm-read-model.mappers';
import { EventReadModelsService } from '../services/event-read-models.service';

@Controller('events')
export class OpsEventReadsController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly floorPlanWorkflowService: FloorPlanWorkflowService,
    private readonly guestWorkflowService: GuestWorkflowService,
  ) {}

  @Get()
  @UseGuards(EventSessionGuard)
  list(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.eventList(actor, this.mappers());
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
          floorPlanWorkflowService: this.floorPlanWorkflowService,
          guestWorkflowService: this.guestWorkflowService,
        }),
    };
  }
}