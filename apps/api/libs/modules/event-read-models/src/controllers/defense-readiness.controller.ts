import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/identity-ops';
import type { PrismVerifiedEventActor } from '@prism/types';
import { EventReadModelsService } from '../services/event-read-models.service';

@Controller('events')
export class OpsDefenseReadinessController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get(':eventId/defense-readiness')
  @UseGuards(EventSessionGuard)
  defenseReadiness(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.defenseReadiness(actor, eventId);
  }
}