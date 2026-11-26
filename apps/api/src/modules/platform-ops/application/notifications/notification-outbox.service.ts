import { ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { OpsNotificationLog } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { createHash, randomUUID } from 'node:crypto';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { AuditActionType, AuditCategory, NotificationChannel } from '@prism/kernel/event-core';
import { AUDIT_WRITER, writeAudit, type AuditWriter } from '@prism/kernel/access-control';
import type { NotificationOutboxChannel } from '../../contracts/notifications/notification-outbox-writer.port';
import type { PrismVerifiedEventActor, NotificationAction } from '@prism/types';
import { NOTIFICATION_DELIVERY, type NotificationDeliveryPort } from '../../contracts/notifications/notification-delivery.port';
import { processNotificationQueue } from './notification-delivery-worker';
import { NotificationPreferenceService } from './notification-preference.service';

export type { NotificationOutboxChannel } from '../../contracts/notifications/notification-outbox-writer.port';

/**
 * The row saved under an idempotency key holds the content now being queued. Routing metadata added later must not
 * resend an already queued notice that was stored without it, so a row without an action matches its original hash too.
 */
function holdsSameContent(saved: Pick<OpsNotificationLog, 'payloadHash' | 'action'>, payloadHash: string, originalHash: string) {
  return saved.payloadHash === payloadHash || (saved.action == null && saved.payloadHash === originalHash);
}

@Injectable()
export class NotificationOutboxService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(NotificationOutboxService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_DELIVERY) private readonly delivery: NotificationDeliveryPort,
    @Optional() @Inject(AUDIT_WRITER) private readonly auditWriter?: AuditWriter,
    @Optional() private readonly preferences?: NotificationPreferenceService,
  ) {}

  async queue(
    eventId: string | undefined,
    recipient: string,
    message: string,
    channel: NotificationOutboxChannel = NotificationChannel.Email,
    options: { correlationId?: string; idempotencyKey?: string; action?: NotificationAction } = {},
    context?: PrismTransactionContext,
  ) {
    const prisma = context?.prisma ?? this.prisma;
    const correlationId = options.correlationId ?? options.idempotencyKey ?? null;
    const payloadHash = createHash('sha256').update(JSON.stringify([eventId ?? null, recipient, message, channel, ...(options.action ? [options.action] : [])])).digest('hex');
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
        action: options.action,
      };
    if (!options.idempotencyKey) return prisma.opsNotificationLog.create({ data });
    // A non-empty no-op update keeps Prisma on PostgreSQL's atomic ON CONFLICT path.
    const saved = await prisma.opsNotificationLog.upsert({ where: { idempotencyKey: options.idempotencyKey }, create: data, update: { idempotencyKey: options.idempotencyKey } });
    const originalHash = createHash('sha256').update(JSON.stringify([eventId ?? null, recipient, message, channel])).digest('hex');
    if (!holdsSameContent(saved, payloadHash, originalHash)) throw new ConflictException('Notification idempotency key is bound to different content');
    return saved;
  }

  async processQueued(options: { maxAttempts?: number } = {}) {
    return processNotificationQueue(this.prisma, this.delivery, options.maxAttempts);
  }

  async listRecipientDeliveries(notificationId: string, actor: PrismVerifiedEventActor) {
    if (actor.role !== 'pmcm-admin') throw new ForbiddenException('Only PMCM can inspect notification delivery');
    const notification = await this.prisma.opsNotificationLog.findUnique({ where: { id: notificationId }, select: { id: true, channel: true } });
    if (!notification) throw new NotFoundException('Notification not found');
    const rows = await this.prisma.opsNotificationDelivery.findMany({
      where: { notificationId }, orderBy: { recipient: 'asc' }, take: 200,
    });
    const readiness = await this.preferences?.deliveryReadiness(rows.map((row) => row.recipient), notification.channel);
    return rows.map((row) => ({
      id: row.id, recipient: row.recipient, status: row.status, attempts: row.attempts,
      failureReason: row.failureReason, acceptedAt: row.acceptedAt?.toISOString() ?? null,
      ...(row.providerOutcome ? { providerOutcome: row.providerOutcome } : {}),
      ...(row.acknowledgedAt ? { acknowledgedAt: row.acknowledgedAt.toISOString() } : {}),
      ...(row.acknowledgmentDueAt ? { acknowledgmentDueAt: row.acknowledgmentDueAt.toISOString() } : {}),
      ...(row.escalatedAt ? { escalatedAt: row.escalatedAt.toISOString() } : {}),
      ...(row.secondEscalatedAt ? { secondEscalatedAt: row.secondEscalatedAt.toISOString() } : {}),
      ...(readiness ? { channelReadiness: readiness.get(row.recipient) } : {}),
    }));
  }

  async retryFailed(notificationId: string, reason: string, actor: PrismVerifiedEventActor) {
    if (actor.role !== 'pmcm-admin') throw new ForbiddenException('Only PMCM can retry notification delivery');
    if (!this.auditWriter) throw new ServiceUnavailableException('Notification audit is unavailable');
    const audit = this.auditWriter;
    return this.prisma.$transaction(async (tx) => {
      const notification = await tx.opsNotificationLog.findUnique({ where: { id: notificationId } });
      if (!notification) throw new NotFoundException('Notification not found');
      if (notification.channel !== 'email' && notification.channel !== 'viber') throw new ConflictException('Retry is available only for tracked email and Viber deliveries');
      const changed = await tx.opsNotificationLog.updateMany({
        where: { id: notificationId, status: 'failed', leaseToken: null },
        data: { status: 'queued', attempts: 0, failureReason: null, failedAt: null, nextAttemptAt: new Date() },
      });
      if (changed.count !== 1) throw new ConflictException('Only a failed notification can be retried');
      await tx.opsNotificationDelivery.updateMany({ where: { notificationId, status: 'failed' }, data: { status: 'pending', failureReason: null } });
      await writeAudit(audit, notification.eventId ?? undefined, actor.name, 'Retried failed notification delivery', {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Events,
        affectedType: 'notification', affectedId: notificationId, metadata: { reason },
      }, { prisma: tx, actorId: actor.id, correlationId: `notification-retry:${notificationId}:${randomUUID()}` });
      return { id: notificationId, status: 'queued' as const };
    });
  }

  onApplicationBootstrap() {
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
}
