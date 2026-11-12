import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { OpsNotificationLog } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { ACCOUNT_CONTACT_READ_MODEL, type AccountContactReadModel } from '@prism/contexts/read-models/account-contacts';
import type { PrismNotificationInboxItem, PrismVerifiedEventActor, RequestNotificationAcknowledgmentInput } from '@prism/types';
import { AUDIT_WRITER, writeAudit, type AuditWriter } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import { notificationActionSchema } from '@prism/types';
import { groupInboxDeliveries } from './notification-inbox-grouping';

const versionOf = (row: OpsNotificationLog) => createHash('sha256').update(JSON.stringify([row.id, row.eventId, row.channel, row.recipient, row.message, row.action ?? null])).digest('hex');

@Injectable()
export class NotificationInboxService {
  constructor(private readonly prisma: PrismaService,
    @Inject(ACCOUNT_CONTACT_READ_MODEL) private readonly contacts: AccountContactReadModel,
    @Inject(AUDIT_WRITER) private readonly audit: AuditWriter) {}

  private async allowed(eventId: string | null, actor: PrismVerifiedEventActor) {
    if (!['pmcm-admin', 'client', 'coordinator', 'supplier'].includes(actor.role)) return false;
    if (actor.role === 'pmcm-admin' || !eventId) return true;
    if (actor.eventId && actor.eventId !== eventId) return false;
    const email = actor.email.trim().toLowerCase();
    if (actor.role === 'client') return (await this.contacts.findEventNotificationContact(eventId))?.clientEmail?.trim().toLowerCase() === email;
    if (actor.role === 'coordinator') return (await this.contacts.findActiveCoordinatorEmailsForEvent(eventId)).some((address) => address.trim().toLowerCase() === email);
    return (await this.contacts.findSelectedSupplierContacts(eventId)).some((supplier) => supplier.email?.trim().toLowerCase() === email);
  }

  async mine(actor: PrismVerifiedEventActor): Promise<PrismNotificationInboxItem[]> {
    const rows = await this.prisma.opsNotificationDelivery.findMany({
      where: { recipient: actor.email.trim().toLowerCase(), status: { not: 'skipped' }, notification: { channel: { in: ['email', 'viber'] } } },
      include: { notification: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100,
    });
    const allowed = await Promise.all(rows.map((row) => this.allowed(row.notification.eventId, actor)));
    return groupInboxDeliveries(rows.flatMap((row, index) => allowed[index] ? [{
      id: row.id, notificationId: row.notificationId, eventId: row.notification.eventId,
      channel: row.notification.channel, message: row.notification.message, version: versionOf(row.notification),
      operationId: row.notification.idempotencyKey,
      createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null,
      acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
      acknowledgmentDueAt: row.acknowledgmentDueAt?.toISOString() ?? null,
      ...(notificationActionSchema.safeParse(row.notification.action).success ? { action: notificationActionSchema.parse(row.notification.action) } : {}),
    }] : [])).slice(0, 50);
  }

  private async own(id: string, version: string, actor: PrismVerifiedEventActor) {
    const row = await this.prisma.opsNotificationDelivery.findFirst({ where: { id, recipient: actor.email.trim().toLowerCase() }, include: { notification: true } });
    if (!row) throw new NotFoundException('Notification not found');
    if (!await this.allowed(row.notification.eventId, actor)) throw new ForbiddenException('Notification is outside your current event access');
    if (version !== versionOf(row.notification)) throw new ConflictException('Notification changed; review it before acknowledging');
    return row;
  }

  async markRead(id: string, version: string, actor: PrismVerifiedEventActor) {
    const row = await this.own(id, version, actor);
    const readAt = row.readAt ?? new Date();
    await this.prisma.opsNotificationDelivery.updateMany({ where: { id, recipient: actor.email.trim().toLowerCase(), readAt: null }, data: { readAt } });
    const saved = await this.prisma.opsNotificationDelivery.findUniqueOrThrow({ where: { id } });
    return { id, readAt: saved.readAt!.toISOString() };
  }

  async acknowledge(id: string, version: string, actor: PrismVerifiedEventActor) {
    const row = await this.own(id, version, actor);
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const changed = await tx.opsNotificationDelivery.updateMany({ where: { id, recipient: actor.email.trim().toLowerCase(), acknowledgedAt: null }, data: { acknowledgedAt: now } });
      await tx.opsNotificationDelivery.updateMany({ where: { id, readAt: null }, data: { readAt: now } });
      if (changed.count) await writeAudit(this.audit, row.notification.eventId ?? undefined, actor.name, 'Acknowledged notification receipt', {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Events,
        affectedType: 'notification_delivery', affectedId: id, metadata: { version },
      }, { prisma: tx, actorId: actor.id, correlationId: `notification-receipt:${id}` });
      return { id, acknowledged: true as const };
    });
  }

  async requireAcknowledgment(id: string, input: RequestNotificationAcknowledgmentInput, actor: PrismVerifiedEventActor) {
    if (actor.role !== 'pmcm-admin') throw new ForbiddenException('Only PMCM can set acknowledgment deadlines');
    const dueAt = new Date(input.dueAt);
    if (dueAt.getTime() <= Date.now()) throw new ConflictException('Choose a future acknowledgment deadline');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.opsNotificationDelivery.findUnique({ where: { id }, include: { notification: true } });
      if (!row) throw new NotFoundException('Notification delivery not found');
      if (row.status === 'skipped') throw new ConflictException('A skipped recipient cannot receive an acknowledgment deadline');
      if (row.acknowledgedAt) throw new ConflictException('This recipient has already acknowledged the notice');
      const changed = await tx.opsNotificationDelivery.updateMany({ where: { id, acknowledgedAt: null }, data: { acknowledgmentDueAt: dueAt, escalatedAt: null, secondEscalatedAt: null } });
      if (changed.count !== 1) throw new ConflictException('Acknowledgment changed; refresh before setting its deadline');
      await writeAudit(this.audit, row.notification.eventId ?? undefined, actor.name, 'Requested notification acknowledgment', {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Events,
        affectedType: 'notification_delivery', affectedId: id, metadata: { dueAt: input.dueAt, reason: input.reason },
      }, { prisma: tx, actorId: actor.id, correlationId: `notification-deadline:${id}:${input.dueAt}` });
      return { id, acknowledgmentDueAt: dueAt.toISOString() };
    });
  }
}
