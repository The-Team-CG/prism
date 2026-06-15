import { Controller, Get, Param, Query } from '@nestjs/common';
import { SampleActorDto } from '../dto/event-ops.dto';
import { EventOpsService } from '../event-ops.service';

@Controller('pmcm')
export class OpsPmcmDashboardController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get('dashboard')
  dashboard(@Query() actor: SampleActorDto) {
    return this.eventOpsService.listPmcmDashboard(actor);
  }

  @Get('command-inbox')
  commandInbox(@Query() actor: SampleActorDto) {
    return this.eventOpsService.listPmcmCommandInbox(actor);
  }

  @Get('events/:eventId/workspace')
  eventWorkspace(@Param('eventId') eventId: string, @Query() actor: SampleActorDto) {
    return this.eventOpsService.getPmcmEventWorkspace(eventId, actor);
  }
}
