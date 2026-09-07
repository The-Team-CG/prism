import { Controller, ForbiddenException, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { mapNotificationLog } from '../../application/notifications/notification.mappers';
import { NotificationOutboxService } from '../../application/notifications/notification-outbox.service';

@Controller('notifications')
export class OpsNotificationsController {
  constructor(private readonly notificationOutboxService: NotificationOutboxService) {}

  @Post(':notificationId/acknowledge')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async acknowledge(@Param('notificationId') notificationId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    if (actor.role !== 'pmcm-admin' && actor.role !== 'system') {
      throw new ForbiddenException('Only trust operators can acknowledge notifications');
    }
    return mapNotificationLog(await this.notificationOutboxService.acknowledge(notificationId));
  }
}
