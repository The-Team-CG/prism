import { Body, Controller, Get, Headers, Param, Patch, StreamableFile, UseGuards } from '@nestjs/common';
import { StorageObjectService } from '@prism/contexts/platform-ops';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { setEventCoverSchema, setEventModulesSchema, setEventPrivacySchema, type PrismVerifiedEventActor, type SetEventCoverInput, type SetEventModulesInput, type SetEventPrivacyInput } from '@prism/types';
import { EventPrivacyService } from '../../application/onboarding/event-privacy.service';

@Controller('events')
export class EventPrivacyController {
  constructor(
    private readonly eventPrivacyService: EventPrivacyService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly storage: StorageObjectService,
  ) {}

  /** A short-lived address for the event's cover image, for anyone who can read the event. 404 when it has none. */
  @Get(':eventId/cover')
  @UseGuards(EventSessionGuard)
  cover(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.storage.issueEventCoverDownloadAuthorization(eventId, this.eventAccessPolicyService.resolveEventScopedActor(verifiedActor));
  }

  /** The cover's bytes when storage is the local file system; a hosted provider's address is fetched directly. */
  @Get(':eventId/cover/content')
  @UseGuards(EventSessionGuard)
  async coverContent(
    @Param('eventId') eventId: string,
    @Headers('x-prism-storage-authorization') downloadUrl: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const cover = await this.storage.readEventCoverContent(eventId, downloadUrl, this.eventAccessPolicyService.resolveEventScopedActor(verifiedActor));
    return new StreamableFile(Buffer.from(cover.bytes), { type: cover.contentType });
  }

  @Patch(':eventId/cover')
  @UseGuards(EventSessionGuard)
  async setEventCover(
    @Param('eventId') eventId: string,
    @Body(zodBody(setEventCoverSchema)) input: SetEventCoverInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'event cover', eventId);
    return this.eventPrivacyService.setEventCover(eventId, input, actor);
  }

  @Patch(':eventId/modules')
  @UseGuards(EventSessionGuard)
  async setEventModules(
    @Param('eventId') eventId: string,
    @Body(zodBody(setEventModulesSchema)) input: SetEventModulesInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'event modules', eventId);
    return this.eventPrivacyService.setEventModules(eventId, input, actor);
  }

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
