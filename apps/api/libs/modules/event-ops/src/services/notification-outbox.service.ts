import { NotFoundException } from '@nestjs/common';
import type { OpsNotificationLog } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { randomUUID } from 'node:crypto';
import { NotificationChannel } from '../ops.constants';

export type NotificationOutboxChannel = 'email' | 'viber';

export class NotificationOutboxService {
  constructor(private readonly prisma: PrismaService) {}

  queue(
    eventId: string | undefined,
    recipient: string,
    message: string,
    channel: NotificationOutboxChannel = NotificationChannel.Email,
    options: { forceFail?: boolean; correlationId?: string } = {},
  ) {
    return this.prisma.opsNotificationLog.create({
      data: {
        id: `not_${randomUUID()}`,
        eventId,
        channel,
        recipient,
        message,
        status: 'queued',
        attempts: 0,
        failureReason: options.forceFail ? 'FORCE_FAIL' : null,
      },
    });
  }

  async processQueued() {
    const queued = await this.prisma.opsNotificationLog.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
    });
    const processed: OpsNotificationLog[] = [];
    for (const notification of queued) {
      const shouldFail = notification.failureReason === 'FORCE_FAIL';
      const updated = await this.prisma.opsNotificationLog.update({
        where: { id: notification.id },
        data: shouldFail
          ? {
              status: 'failed',
              attempts: (notification.attempts ?? 0) + 1,
              failedAt: new Date(),
              failureReason: 'Sample adapter forced failure',
            }
          : {
              status: 'sent',
              attempts: (notification.attempts ?? 0) + 1,
              sentAt: new Date(),
              failureReason: null,
            },
      });
      processed.push(updated);
    }
    return processed;
  }

  acknowledge(notificationId: string) {
    return this.prisma.opsNotificationLog
      .update({
        where: { id: notificationId },
        data: { status: 'acknowledged', acknowledgedAt: new Date() },
      })
      .catch(() => {
        throw new NotFoundException('Notification not found');
      });
  }
}
