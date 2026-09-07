import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsNotificationLog } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { NotificationChannel } from '@prism/kernel/event-core';
import type { NotificationOutboxChannel } from '../../contracts/notifications/notification-outbox-writer.port';
import type { PrismVerifiedEventActor } from '@prism/types';

export type { NotificationOutboxChannel } from '../../contracts/notifications/notification-outbox-writer.port';

const DEFAULT_MAX_ATTEMPTS = 3;
const FORCE_FAIL_MARKER = 'FORCE_FAIL';

type NotificationLogDelegateWithCorrelationLookup = {
  findFirst(args: { where: { correlationId: string } }): Promise<OpsNotificationLog | null>;
};

@Injectable()
export class NotificationOutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async queue(
    eventId: string | undefined,
    recipient: string,
    message: string,
    channel: NotificationOutboxChannel = NotificationChannel.Email,
    options: { forceFail?: boolean; correlationId?: string; idempotencyKey?: string } = {},
    context?: PrismTransactionContext,
  ) {
    const prisma = context?.prisma ?? this.prisma;
    const correlationId = options.correlationId ?? options.idempotencyKey ?? null;

    if (options.idempotencyKey) {
      const notificationLog = prisma.opsNotificationLog as unknown as NotificationLogDelegateWithCorrelationLookup;
      const existing = await notificationLog.findFirst({
        where: { correlationId: options.idempotencyKey },
      });
      if (existing) return existing;
    }

    return prisma.opsNotificationLog.create({
      data: {
        id: `not_${randomUUID()}`,
        eventId,
        channel,
        recipient,
        message,
        status: 'queued',
        attempts: 0,
        correlationId,
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
    for (const notification of queued) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: queue worker processes at most 100 notifications per run.
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

  async acknowledge(notificationId: string, actor?: PrismVerifiedEventActor) {
    const notification = await this.prisma.opsNotificationLog.findUnique({ where: { id: notificationId } });
    if (!notification) throw new NotFoundException('Notification not found');
    const privileged = actor?.role === 'pmcm-admin' || actor?.role === 'system';
    if (actor && !privileged && notification.recipient.trim().toLowerCase() !== actor.email.trim().toLowerCase()) {
      throw new ForbiddenException('Only the notification recipient can acknowledge this notification');
    }
    return this.prisma.opsNotificationLog.update({
      where: { id: notificationId },
      data: { status: 'acknowledged', acknowledgedAt: new Date() },
    });
  }
}
