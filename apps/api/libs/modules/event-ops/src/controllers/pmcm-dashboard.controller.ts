import { Controller, Get, Query } from '@nestjs/common';
import { SampleActorDto } from '../dto/event-ops.dto';
import { EventOpsService } from '../event-ops.service';

@Controller('pmcm')
export class OpsPmcmDashboardController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get('dashboard')
  dashboard(@Query() actor: SampleActorDto) {
    return this.eventOpsService.listPmcmDashboard(actor);
  }
}
