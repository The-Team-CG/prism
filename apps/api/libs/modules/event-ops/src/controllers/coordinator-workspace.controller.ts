import { Controller, Get, Param, Query } from '@nestjs/common';
import { SampleActorDto } from '../dto/event-ops.dto';
import { EventOpsService } from '../event-ops.service';
export { OpsCoordinatorWorkspaceController as OpsCoordinatorWorkspaceReadController, OpsCoordinatorsController } from '@prism/modules/staffing-ops';

@Controller('coordinator')
export class OpsCoordinatorWorkspaceController {
  constructor(private readonly eventOpsService: EventOpsService) {}


  @Get('events/:eventId/role-view')
  roleView(@Param('eventId') eventId: string, @Query() actor: SampleActorDto) {
    return this.eventOpsService.getCoordinatorRoleView(eventId, actor);
  }
}
