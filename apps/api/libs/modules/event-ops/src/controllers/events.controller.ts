import { Controller, Get, Param, Query } from '@nestjs/common';
import { SampleActorDto } from '../dto/event-ops.dto';
import { EventOpsService } from '../event-ops.service';

@Controller('events')
export class OpsEventsController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get(':eventId/defense-readiness')
  defenseReadiness(@Param('eventId') eventId: string, @Query() actor: SampleActorDto) {
    return this.eventOpsService.getDefenseReadiness(eventId, actor);
  }
}
