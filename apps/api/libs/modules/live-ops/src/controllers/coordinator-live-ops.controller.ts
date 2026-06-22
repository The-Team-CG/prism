import { Controller, Get, Param, Query } from '@nestjs/common';
import { LiveOpsActorDto } from '../dto/live-ops.dto';
import { EventLiveOpsReadService } from '../services/event-live-ops-read.service';

@Controller('coordinator')
export class CoordinatorLiveOpsController {
  constructor(private readonly readService: EventLiveOpsReadService) {}

  @Get('events/:eventId/role-view')
  roleView(@Param('eventId') eventId: string, @Query() actor: LiveOpsActorDto) {
    return this.readService.getCoordinatorRoleView(eventId, actor);
  }
}