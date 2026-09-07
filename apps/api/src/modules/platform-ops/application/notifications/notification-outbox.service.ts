import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { OpsNotificationLog } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { createHash, randomUUID } from 'node:crypto';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { NotificationChannel } from '@prism/kernel/event-core';
import type { NotificationOutboxChannel } from '../../contracts/notifications/notification-outbox-writer.port';
import type { PrismVerifiedEventActor } from '@prism/types';
import { NOTIFICATION_DELIVERY, type NotificationDeliveryPort } from '../../contracts/notifications/notification-delivery.port';
import { processNotificationQueue } from './notification-delivery-worker';

export type { NotificationOutboxChannel } from '../../contracts/notifications/notification-outbox-writer.port';

const FORCE_FAIL_MARKER = 'FORCE_FAIL';

@Injectable()
export class NotificationOutboxService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(NOTIFICATION_DELIVERY) private readonly delivery?: NotificationDeliveryPort,
  ) {}

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
    const legacy = await this.findLegacyRetry(prisma, options.idempotencyKey);
    if (legacy) {
      if (legacy.eventId !== (eventId ?? null) || legacy.recipient !== recipient || legacy.message !== message || legacy.channel !== channel) {
        throw new ConflictException('Notification idempotency key is bound to different content');
      }
      return legacy;
    }

    const payloadHash = createHash('sha256').update(JSON.stringify([eventId ?? null, recipient, message, channel, options.forceFail ?? false])).digest('hex');
    const data = {
        id: `not_${randomUUID()}`,
        eventId,
        channel,
        recipient,
        message,
        status: 'queued',
        attempts: 0,
        correlationId,
        idempotencyKey: options.idempotencyKey ?? null,
        payloadHash,
        failureReason: options.forceFail ? FORCE_FAIL_MARKER : null,
      };
    if (!options.idempotencyKey) return prisma.opsNotificationLog.create({ data });
    // A non-empty no-op update keeps Prisma on PostgreSQL's atomic ON CONFLICT path.
    const saved = await prisma.opsNotificationLog.upsert({ where: { idempotencyKey: options.idempotencyKey }, create: data, update: { idempotencyKey: options.idempotencyKey } });
    if (saved.payloadHash !== payloadHash) throw new ConflictException('Notification idempotency key is bound to different content');
    return saved;
  }

  async processQueued(options: { maxAttempts?: number } = {}) {
    return processNotificationQueue(this.prisma, this.delivery, options.maxAttempts);
  }

  private findLegacyRetry(prisma: PrismaService | PrismTransactionContext['prisma'], key?: string) {
    if (!key) return Promise.resolve(null);
    // Earlier versions stored idempotency only in correlationId. Preserve those retries.
    return prisma.opsNotificationLog.findFirst({ where: { correlationId: key, idempotencyKey: null } });
  }

  async acknowledge(notificationId: string, actor?: PrismVerifiedEventActor) {
    const notification = await this.prisma.opsNotificationLog.findUnique({ where: { id: notificationId } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (this.hasRecipientMismatch(notification, actor)) {
      throw new ForbiddenException('Only the notification recipient can acknowledge this notification');
    }
    if (this.hasEventScopeMismatch(notification, actor)) {
      throw new ForbiddenException('Notification is outside the actor event scope');
    }
    return this.prisma.opsNotificationLog.update({
      where: { id: notificationId },
      data: { status: 'acknowledged', acknowledgedAt: new Date() },
    });
  }

  private isPrivileged(actor?: PrismVerifiedEventActor) {
    return !actor || actor.role === 'pmcm-admin' || actor.role === 'system';
  }

  private hasRecipientMismatch(notification: OpsNotificationLog, actor?: PrismVerifiedEventActor) {
    return Boolean(actor && !this.isPrivileged(actor) && notification.recipient.trim().toLowerCase() !== actor.email.trim().toLowerCase());
  }

  private hasEventScopeMismatch(notification: OpsNotificationLog, actor?: PrismVerifiedEventActor) {
    return Boolean(actor && !this.isPrivileged(actor) && notification.eventId && actor.eventId && notification.eventId !== actor.eventId);
  }
}
