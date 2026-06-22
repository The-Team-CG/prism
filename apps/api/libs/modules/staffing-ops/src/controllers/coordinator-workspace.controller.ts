import { Controller, Get, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { SampleActorDto } from '../dto/staffing-ops.dto';
import { CoordinatorWorkspaceReadService } from '../services/coordinator-workspace-read.service';

@Controller('coordinator')
export class OpsCoordinatorWorkspaceController {
  constructor(
    private readonly coordinatorWorkspaceReadService: CoordinatorWorkspaceReadService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('workspace')
  getCoordinatorWorkspace(@Query() actorInput: SampleActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.coordinatorWorkspaceReadService.listCoordinatorWorkspace(actor);
  }
}
