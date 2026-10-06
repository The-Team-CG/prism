import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  updateGuestPrivacyClassificationSchema,
  type PrismGuestPrivacyClassification,
  type PrismVerifiedEventActor,
  type UpdateGuestPrivacyClassificationInput,
} from '@prism/types';
import { GuestPrivacyClassificationService } from '../../application/guest/guest-privacy-classification.service';

@Controller('events/:eventId/guest-privacy')
export class GuestPrivacyClassificationController {
  constructor(
    private readonly access: EventAccessPolicyService,
    private readonly privacy: GuestPrivacyClassificationService,
  ) {}

  @Get()
  @UseGuards(EventSessionGuard)
  async get(
    @Param('eventId') eventId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ): Promise<PrismGuestPrivacyClassification> {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'guest privacy classification',
      eventId,
    );
    return this.privacy.get(eventId);
  }

  @Patch()
  @UseGuards(EventSessionGuard)
  async update(
    @Param('eventId') eventId: string,
    @Body(zodBody(updateGuestPrivacyClassificationSchema)) input: UpdateGuestPrivacyClassificationInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ): Promise<PrismGuestPrivacyClassification> {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'guest privacy classification update',
      eventId,
    );
    return this.privacy.update(eventId, input, actor);
  }
}
