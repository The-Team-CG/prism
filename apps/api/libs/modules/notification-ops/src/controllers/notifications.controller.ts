import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { mapNotificationLog } from '../mappers/notification.mappers';
import { NotificationOutboxService } from '../services/notification-outbox.service';

@Controller('notifications')
export class OpsNotificationsController {
  constructor(private readonly notificationOutboxService: NotificationOutboxService) {}

  @Post(':notificationId/acknowledge')
  @HttpCode(HttpStatus.OK)
  async acknowledge(@Param('notificationId') notificationId: string) {
    return mapNotificationLog(await this.notificationOutboxService.acknowledge(notificationId));
  }
}
