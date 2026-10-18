import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { HandoffBriefReadModelsService } from '../application/services/handoff-brief-read-models.service';

@Controller('events')
export class OpsHandoffBriefController {
  constructor(
    private readonly handoffBriefService: HandoffBriefReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get(':eventId/handoff-brief')
  @UseGuards(EventSessionGuard)
  handoffBrief(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.handoffBriefService.getHandoffBrief(eventId, actor);
  }
}
