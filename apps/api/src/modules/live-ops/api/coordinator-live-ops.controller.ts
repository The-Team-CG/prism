import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { EventLiveOpsReadService } from '../application/event-live-ops-read.service';

@Controller('coordinator')
export class CoordinatorLiveOpsController {
  constructor(
    private readonly readService: EventLiveOpsReadService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  /** The role view for the coordinator's next upcoming (else latest) assigned event; null when nothing is assigned. */
  @Get('focus-role-view')
  @UseGuards(EventSessionGuard)
  focusRoleView(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.readService.getCoordinatorFocusRoleView(actor);
  }

  @Get('events/:eventId/role-view')
  @UseGuards(EventSessionGuard)
  roleView(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.readService.getCoordinatorRoleView(eventId, actor);
  }
}
