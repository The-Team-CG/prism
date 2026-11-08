import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { setEventPrivacySchema, type PrismVerifiedEventActor, type SetEventPrivacyInput } from '@prism/types';
import { EventPrivacyService } from '../../application/onboarding/event-privacy.service';

@Controller('events')
export class EventPrivacyController {
  constructor(
    private readonly eventPrivacyService: EventPrivacyService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Patch(':eventId/privacy')
  @UseGuards(EventSessionGuard)
  async setEventPrivacy(
    @Param('eventId') eventId: string,
    @Body(zodBody(setEventPrivacySchema)) input: SetEventPrivacyInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'event privacy', eventId);
    return this.eventPrivacyService.setEventPrivacy(eventId, input, actor);
  }
}
