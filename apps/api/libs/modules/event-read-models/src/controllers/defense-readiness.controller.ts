import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { SampleActorDto } from '../dto/read-model.dto';
import { EventReadModelsService } from '../services/event-read-models.service';

@Controller('events')
export class OpsDefenseReadinessController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get(':eventId/defense-readiness')
  defenseReadiness(@Param('eventId') eventId: string, @Query() actorInput: SampleActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.eventReadModelsService.defenseReadiness(actor, eventId);
  }
}