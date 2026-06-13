import { NotFoundException } from '@nestjs/common';
import type { OpsNotificationLog } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { randomUUID } from 'node:crypto';
import { NotificationChannel } from '../ops.constants';

export type NotificationOutboxChannel = 'email' | 'viber' | 'zoom' | 'canva' | 'storage' | 'ai';

const DEFAULT_MAX_ATTEMPTS = 3;
const FORCE_FAIL_MARKER = 'FORCE_FAIL';

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
        correlationId: options.correlationId ?? null,
        failureReason: options.forceFail ? FORCE_FAIL_MARKER : null,
      },
    });
  }

  async processQueued(options: { maxAttempts?: number } = {}) {
    const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    const queued = await this.prisma.opsNotificationLog.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
    });
    const processed: OpsNotificationLog[] = [];
    for (const notification of queued) {
      const nextAttempt = (notification.attempts ?? 0) + 1;
      const shouldFail = notification.failureReason?.startsWith(FORCE_FAIL_MARKER) ?? false;
      const permanentlyFailed = shouldFail && nextAttempt >= maxAttempts;
      const updated = await this.prisma.opsNotificationLog.update({
        where: { id: notification.id },
        data: shouldFail
          ? {
              status: permanentlyFailed ? 'failed' : 'queued',
              attempts: nextAttempt,
              failedAt: new Date(),
              failureReason: `${FORCE_FAIL_MARKER}: Sample adapter forced failure (${nextAttempt}/${maxAttempts})`,
            }
          : {
              status: 'sent',
              attempts: nextAttempt,
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
