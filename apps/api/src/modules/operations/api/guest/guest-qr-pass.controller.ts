import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { OpsUserRole } from '@prism/kernel/event-core';
import { zodBody } from '@prism/kernel/shared';
import { guestQrCheckInSchema, type GuestQrCheckInInput, type PrismVerifiedEventActor } from '@prism/types';
import { GuestQrPassService } from '../../application/guest/guest-qr-pass.service';
import { GuestWorkflowService } from '../../application/guest/guest-workflow.service';

@Controller('guest/events/:eventId')
@UseGuards(EventSessionGuard)
export class GuestQrPassController {
  constructor(
    private readonly passes: GuestQrPassService,
    private readonly guests: GuestWorkflowService,
    private readonly access: EventAccessPolicyService,
  ) {}

  @Get('qr-passes')
  list(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.passes.listPasses(eventId, this.access.resolveActor({}, verified));
  }

  @Post('qr-passes')
  issue(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.passes.issuePasses(eventId, this.access.resolveActor({}, verified));
  }

  @Post('qr-check-in')
  @HttpCode(HttpStatus.CREATED)
  async checkIn(@Param('eventId') eventId: string, @Body(zodBody(guestQrCheckInSchema)) input: GuestQrCheckInInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    const actor = this.access.resolveActor({}, verified);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.Coordinator, OpsUserRole.System], 'guest QR check-in', eventId);
    return this.guests.mapGuestCheckIn(await this.passes.checkInByToken(eventId, input.token, actor));
  }
}
