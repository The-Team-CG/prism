import { Controller, Get, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/identity-ops';
import type { PrismVerifiedEventActor } from '@prism/types';
import { CoordinatorWorkspaceReadService } from '../services/coordinator-workspace-read.service';

@Controller('coordinator')
export class OpsCoordinatorWorkspaceController {
  constructor(
    private readonly coordinatorWorkspaceReadService: CoordinatorWorkspaceReadService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('workspace')
  @UseGuards(EventSessionGuard)
  getCoordinatorWorkspace(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.coordinatorWorkspaceReadService.listCoordinatorWorkspace(actor);
  }
}
