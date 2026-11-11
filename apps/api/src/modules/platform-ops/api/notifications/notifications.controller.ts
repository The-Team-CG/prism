import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { retryNotificationSchema, type PrismVerifiedEventActor, type RetryNotificationInput } from '@prism/types';
import { zodBody } from '@prism/kernel/shared';
import { mapNotificationLog } from '../../application/notifications/notification.mappers';
import { NotificationOutboxService } from '../../application/notifications/notification-outbox.service';

@Controller('notifications')
export class OpsNotificationsController {
  constructor(private readonly notificationOutboxService: NotificationOutboxService) {}

  @Get(':notificationId/deliveries')
  @UseGuards(EventSessionGuard)
  async deliveries(@Param('notificationId') notificationId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.notificationOutboxService.listRecipientDeliveries(notificationId, actor);
  }

  @Post(':notificationId/retry')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async retry(@Param('notificationId') notificationId: string, @Body(zodBody(retryNotificationSchema)) input: RetryNotificationInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.notificationOutboxService.retryFailed(notificationId, input.reason, actor);
  }

  @Post(':notificationId/acknowledge')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async acknowledge(@Param('notificationId') notificationId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return mapNotificationLog(await this.notificationOutboxService.acknowledge(notificationId, actor));
  }
}
