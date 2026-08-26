import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/identity-ops';
import type { PrismVerifiedEventActor } from '@prism/types';
import { EventLiveOpsReadService } from '../services/event-live-ops-read.service';

@Controller('coordinator')
export class CoordinatorLiveOpsController {
  constructor(
    private readonly readService: EventLiveOpsReadService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('events/:eventId/role-view')
  @UseGuards(EventSessionGuard)
  roleView(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.readService.getCoordinatorRoleView(eventId, actor);
  }
}
