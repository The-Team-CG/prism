import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/identity-ops';
import type { PrismVerifiedEventActor } from '@prism/types';
import { EventLiveOpsReadService } from '../services/event-live-ops-read.service';

@Controller('coordinator')
export class CoordinatorLiveOpsController {
  constructor(private readonly readService: EventLiveOpsReadService) {}

  @Get('events/:eventId/role-view')
  @UseGuards(EventSessionGuard)
  roleView(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.readService.getCoordinatorRoleView(eventId, {}, verifiedActor);
  }
}