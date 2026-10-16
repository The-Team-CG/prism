import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { GUEST_QR_PASS_COMMANDS } from '../../contracts/guest-ops.tokens';
import type { GuestQrPassCommands } from '../../contracts/guest-qr-pass.port';
import { GuestQrDemoPolicyService } from '../../application/guest/guest-qr-demo-policy.service';

const PMCM_ROLES = [OpsUserRole.PmcmAdmin, OpsUserRole.System] as const;

@Controller('events/:eventId/guest-qr-passes')
@UseGuards(EventSessionGuard)
export class OpsGuestQrPassController {
  constructor(
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly demoPolicy: GuestQrDemoPolicyService,
    @Inject(GUEST_QR_PASS_COMMANDS) private readonly guestQrPassCommands: GuestQrPassCommands,
  ) {}

  @Get()
  async list(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = await this.requirePmcm(verifiedActor, eventId);
    return this.guestQrPassCommands.list(eventId, actor);
  }

  @Get(':passId')
  async get(
    @Param('eventId') eventId: string,
    @Param('passId') passId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requirePmcm(verifiedActor, eventId);
    return this.guestQrPassCommands.get(eventId, passId, actor);
  }

  @Post('roster/:rosterEntryId')
  @HttpCode(HttpStatus.CREATED)
  async issue(
    @Param('eventId') eventId: string,
    @Param('rosterEntryId') rosterEntryId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requirePmcm(verifiedActor, eventId);
    return this.guestQrPassCommands.issue(eventId, rosterEntryId, actor);
  }

  @Post(':passId/retry')
  @HttpCode(HttpStatus.OK)
  async retry(
    @Param('eventId') eventId: string,
    @Param('passId') passId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requirePmcm(verifiedActor, eventId);
    return this.guestQrPassCommands.retry(eventId, passId, actor);
  }

  @Post(':passId/reissue')
  @HttpCode(HttpStatus.OK)
  async reissue(
    @Param('eventId') eventId: string,
    @Param('passId') passId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requirePmcm(verifiedActor, eventId);
    return this.guestQrPassCommands.reissue(eventId, passId, actor);
  }

  @Post(':passId/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @Param('eventId') eventId: string,
    @Param('passId') passId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requirePmcm(verifiedActor, eventId);
    return this.guestQrPassCommands.revoke(eventId, passId, actor);
  }

  private async requirePmcm(verifiedActor: PrismVerifiedEventActor, eventId: string) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [...PMCM_ROLES], 'guest QR pass management', eventId);
    if (!this.demoPolicy.isEnabledForEvent(eventId)) {
      throw new ServiceUnavailableException('Guest QR passes are unavailable');
    }
    return actor;
  }
}
