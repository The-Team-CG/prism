import { ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OpsNotificationLog } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { createHash, randomUUID } from 'node:crypto';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { NotificationChannel } from '@prism/kernel/event-core';
import type { GuestPassDeliveryWriteInput, NotificationOutboxChannel } from '../../contracts/notifications/notification-outbox-writer.port';
import type { PrismVerifiedEventActor } from '@prism/types';
import { NOTIFICATION_DELIVERY, type NotificationDeliveryPort } from '../../contracts/notifications/notification-delivery.port';
import {
  GUEST_PASS_DELIVERY_ELIGIBILITY_READER,
  type GuestPassDeliveryEligibilityReader,
} from '@prism/contexts/read-models/guest-pass-delivery-eligibility';
import {
  encryptGuestPassPayload,
  guestPassPayloadHash,
  GUEST_PASS_MESSAGE_PLACEHOLDER,
  parseGuestPassEncryptionKey,
} from '../../infrastructure/notifications/notification-sensitive-payload.crypto';
import { processNotificationQueue } from './notification-delivery-worker';

export type { NotificationOutboxChannel } from '../../contracts/notifications/notification-outbox-writer.port';

type NotificationConfigReader = { get(key: string): unknown };

@Injectable()
export class NotificationOutboxService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(NotificationOutboxService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(NOTIFICATION_DELIVERY) private readonly delivery?: NotificationDeliveryPort,
    @Optional() @Inject(ConfigService) private readonly config?: NotificationConfigReader,
    @Optional() @Inject(GUEST_PASS_DELIVERY_ELIGIBILITY_READER)
    private readonly guestPassDeliveryEligibilityReader?: GuestPassDeliveryEligibilityReader,
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
        failureReason: this.delivery?.deliveryMode === 'provider' ? null : 'Delivery provider is not configured',
      };
    if (!options.idempotencyKey) return prisma.opsNotificationLog.create({ data });
    // A non-empty no-op update keeps Prisma on PostgreSQL's atomic ON CONFLICT path.
    const saved = await prisma.opsNotificationLog.upsert({ where: { idempotencyKey: options.idempotencyKey }, create: data, update: { idempotencyKey: options.idempotencyKey } });
    if (saved.payloadHash !== payloadHash) throw new ConflictException('Notification idempotency key is bound to different content');
    return saved;
  }

  async writeGuestPassDelivery(input: GuestPassDeliveryWriteInput, context?: PrismTransactionContext) {
    const key = parseGuestPassEncryptionKey(this.config?.get('GUEST_QR_DELIVERY_ENCRYPTION_KEY'));
    if (!key || this.delivery?.deliveryMode !== 'capture') {
      throw new ServiceUnavailableException('Guest pass delivery is not available without capture-only delivery and its managed key');
    }
    if (!input.eventId.trim() || !input.passId.trim() || !input.recipient.trim() || !input.plaintextMessage.trim() || !input.idempotencyKey.trim()) {
      throw new ServiceUnavailableException('Guest pass delivery is not available');
    }

    let sensitivePayload: string;
    let payloadHash: string;
    try {
      sensitivePayload = encryptGuestPassPayload(input.plaintextMessage, key);
      payloadHash = guestPassPayloadHash([
        input.eventId,
        input.passId,
        input.recipient,
        input.plaintextMessage,
        NotificationChannel.Email,
      ], key);
    } catch {
      throw new ServiceUnavailableException('Guest pass delivery is not available');
    }

    const prisma = context?.prisma ?? this.prisma;
    const data = {
      id: `not_${randomUUID()}`,
      eventId: input.eventId,
      guestPassId: input.passId,
      channel: NotificationChannel.Email,
      recipient: input.recipient,
      message: GUEST_PASS_MESSAGE_PLACEHOLDER,
      sensitivePayload,
      status: 'queued',
      attempts: 0,
      correlationId: input.idempotencyKey,
      idempotencyKey: input.idempotencyKey,
      payloadHash,
      failureReason: null,
    };
    const saved = await prisma.opsNotificationLog.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: data,
      update: { idempotencyKey: input.idempotencyKey },
    });
    if (saved.payloadHash !== payloadHash) {
      throw new ConflictException('Guest pass notification idempotency key is bound to different content');
    }
    return { notificationId: saved.id, status: 'queued' as const };
  }

  async cancelGuestPassDelivery(notificationId: string, context?: PrismTransactionContext): Promise<void> {
    const prisma = context?.prisma ?? this.prisma;
    await prisma.opsNotificationLog.updateMany({
      where: { id: notificationId, guestPassId: { not: null }, status: 'queued' },
      data: {
        status: 'cancelled',
        sensitivePayload: null,
        leaseToken: null,
        leaseExpiresAt: null,
        failureReason: 'Guest pass delivery canceled',
      },
    });
  }

  async retryGuestPassDelivery(notificationId: string, context?: PrismTransactionContext): Promise<void> {
    const prisma = context?.prisma ?? this.prisma;
    const updated = await prisma.opsNotificationLog.updateMany({
      where: {
        id: notificationId,
        guestPassId: { not: null },
        status: 'queued',
        sensitivePayload: { not: null },
        leaseToken: null,
      },
      data: { nextAttemptAt: new Date(), failureReason: null, failedAt: null },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Guest pass delivery cannot be retried; reissue the pass');
    }
  }

  async processQueued(options: { maxAttempts?: number } = {}) {
    return processNotificationQueue(this.prisma, this.delivery, {
      ...options,
      encryptionKey: this.config?.get('GUEST_QR_DELIVERY_ENCRYPTION_KEY'),
      guestPassDeliveryEligibilityReader: this.guestPassDeliveryEligibilityReader,
    });
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
