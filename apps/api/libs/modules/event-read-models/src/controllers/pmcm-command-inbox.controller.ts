import { Controller, Get, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { EventReadModelsService } from '../services/event-read-models.service';

@Controller('pmcm')
export class OpsPmcmCommandInboxController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('command-inbox')
  @UseGuards(EventSessionGuard)
  commandInbox(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.pmcmCommandInbox(actor);
  }
}
