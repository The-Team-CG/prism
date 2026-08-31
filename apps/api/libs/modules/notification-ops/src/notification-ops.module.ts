import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { NOTIFICATION_OUTBOX_WRITER } from './ports/notification-ops.tokens';
import { OpsNotificationsController } from './controllers/notifications.controller';
import { NotificationOutboxWriterAdapter } from './ports/notification-outbox-writer.adapter';
import { NotificationOutboxService } from './services/notification-outbox.service';

const notificationOutboxWriterProvider = {
  provide: NOTIFICATION_OUTBOX_WRITER,
  useExisting: NotificationOutboxWriterAdapter,
};

/**
 * Owned tables: OpsNotificationLog (notification-ops writes queued/sent notifications; trust-ops also writes here for its own audit-triggered notifications).
 * Read-only: none.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [OpsNotificationsController],
  providers: [NotificationOutboxService, NotificationOutboxWriterAdapter, notificationOutboxWriterProvider],
  exports: [NotificationOutboxService, NotificationOutboxWriterAdapter, notificationOutboxWriterProvider],
})
export class NotificationOpsModule {}
