import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Patch, Post, Req, UseGuards, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { updateNotificationPreferencesSchema, type PrismVerifiedEventActor, type UpdateNotificationPreferencesInput } from '@prism/types';
import { NotificationPreferenceService } from '../../application/notifications/notification-preference.service';

/** FR-25: the signed-in account's own notification channels. */
@Controller('notification-preferences')
@UseGuards(EventSessionGuard)
export class NotificationPreferencesController {
  constructor(private readonly preferences: NotificationPreferenceService) {}

  @Get('me')
  mine(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.preferences.get(actor);
  }

  @Patch('me')
  update(@Body(zodBody(updateNotificationPreferencesSchema)) input: UpdateNotificationPreferencesInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.preferences.setViberEnabled(actor, input.viberEnabled);
  }

  @Post('viber-link')
  @HttpCode(HttpStatus.OK)
  link(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.preferences.startViberLink(actor);
  }

  @Delete('viber')
  unlink(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.preferences.unlinkViber(actor);
  }
}

/** Viber's callback for the P.R.I.S.M bot. Public, but every request must carry Viber's HMAC signature. */
@Controller('integrations/viber')
export class ViberWebhookController {
  constructor(private readonly preferences: NotificationPreferenceService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  callback(@Req() request: RawBodyRequest<Request>, @Headers('x-viber-content-signature') signature: string | undefined) {
    return this.preferences.handleViberCallback(request.rawBody, signature);
  }
}
