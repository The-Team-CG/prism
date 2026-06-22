import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { SampleActorDto } from '../dto/event-ops.dto';
import { EventOpsService } from '../event-ops.service';

@Controller('events')
export class OpsEventsController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get(':eventId/defense-readiness')
  defenseReadiness(@Param('eventId') eventId: string, @Query() actor: SampleActorDto) {
    return this.eventOpsService.getDefenseReadiness(eventId, actor);
  }

  @Patch(':eventId/quote-requests/:requestId/withdraw')
  withdrawSupplier(
    @Param('eventId') _eventId: string,
    @Param('requestId') requestId: string,
    @Body() dto: { reason?: string } = {},
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.withdrawSupplier(requestId, dto.reason ?? 'Withdrawn by PMCM Admin', actor);
  }
}
