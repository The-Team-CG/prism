import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { FloorPlanWorkflowService } from '@prism/modules/floorplan';
import { GuestWorkflowService } from '@prism/modules/guest-ops';
import { SampleActorDto } from '../dto/read-model.dto';
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
  list(@Query() actorInput: SampleActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.eventReadModelsService.eventList(actor, this.mappers());
  }

  @Get(':eventId')
  detail(@Param('eventId') eventId: string, @Query() actorInput: SampleActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
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