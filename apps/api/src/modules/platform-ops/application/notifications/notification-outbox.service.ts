import { ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, Optional, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
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

@Injectable()
export class NotificationOutboxService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(NotificationOutboxService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(NOTIFICATION_DELIVERY) private readonly delivery?: NotificationDeliveryPort,
  ) {}

  async queue(
    eventId: string | undefined,
    recipient: string,
    message: string,
    channel: NotificationOutboxChannel = NotificationChannel.Email,
    options: { correlationId?: string; idempotencyKey?: string } = {},
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

    const payloadHash = createHash('sha256').update(JSON.stringify([eventId ?? null, recipient, message, channel])).digest('hex');
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
        failureReason: this.delivery ? null : 'Delivery provider is not configured',
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

  onApplicationBootstrap() {
    if (!this.delivery) return;
    this.timer = setInterval(() => { void this.runScheduled(); }, 30_000);
    this.timer.unref();
    void this.runScheduled();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async runScheduled() {
    if (this.running) return;
    this.running = true;
    try { await this.processQueued(); }
    catch { this.logger.warn('Notification queue sweep failed; durable work remains available for retry'); }
    finally { this.running = false; }
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
    if (notification.status === 'acknowledged') return notification;
    if (notification.status !== 'sent') throw new ConflictException('Only a provider-accepted notification can be acknowledged');
    const updated = await this.prisma.opsNotificationLog.updateMany({
      where: { id: notificationId, status: 'sent' },
      data: { status: 'acknowledged', acknowledgedAt: new Date() },
    });
    const saved = await this.prisma.opsNotificationLog.findUniqueOrThrow({ where: { id: notificationId } });
    if (updated.count !== 1 && saved.status !== 'acknowledged') throw new ConflictException('Notification state changed; refresh before acknowledging');
    return saved;
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
