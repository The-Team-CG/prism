import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { OpsNotificationDelivery, OpsNotificationLog } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { ACCOUNT_CONTACT_READ_MODEL, type AccountContactReadModel } from '@prism/contexts/read-models/account-contacts';
import type { PrismNotificationInbox, PrismVerifiedEventActor, RequestNotificationAcknowledgmentInput } from '@prism/types';
import { AUDIT_WRITER, writeAudit, type AuditWriter } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import { notificationActionSchema } from '@prism/types';
import { groupInboxDeliveries } from './notification-inbox-grouping';

const INBOX_CHANNELS = ['email', 'viber'];
/** One notice reaches an account on up to this many channels, so a page of notices reads this many deliveries each. */
const COPIES_PER_NOTICE = INBOX_CHANNELS.length;
/** The unread count looks at this many of the newest unread deliveries; the navigation shows 99+ well before it. */
const UNREAD_SCAN_LIMIT = 200;

type InboxRow = OpsNotificationDelivery & { notification: OpsNotificationLog };

const versionOf = (row: OpsNotificationLog) => createHash('sha256').update(JSON.stringify([row.id, row.eventId, row.channel, row.recipient, row.message, row.action ?? null])).digest('hex');

function inboxDelivery(row: InboxRow, eventName: string | null) {
  const action = notificationActionSchema.safeParse(row.notification.action);
  return {
    id: row.id, notificationId: row.notificationId, eventId: row.notification.eventId, eventName,
    channel: row.notification.channel, message: row.notification.message, version: versionOf(row.notification),
    operationId: row.notification.idempotencyKey,
    createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    acknowledgmentDueAt: row.acknowledgmentDueAt?.toISOString() ?? null,
    ...(action.success ? { action: action.data } : {}),
  };
}

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

  private ownDeliveries(actor: PrismVerifiedEventActor) {
    return { recipient: actor.email.trim().toLowerCase(), status: { not: 'skipped' }, notification: { channel: { in: INBOX_CHANNELS } } };
  }

  /** The deliveries whose event the account can still open; access is looked up once per event, not once per row. */
  private async withAccess<T extends { notification: { eventId: string | null } }>(rows: T[], actor: PrismVerifiedEventActor): Promise<T[]> {
    const eventIds = [...new Set(rows.map((row) => row.notification.eventId))];
    const access = new Map(await Promise.all(eventIds.map(async (eventId) => [eventId, await this.allowed(eventId, actor)] as const)));
    return rows.filter((row) => access.get(row.notification.eventId));
  }

  async mine(actor: PrismVerifiedEventActor, limit: number): Promise<PrismNotificationInbox> {
    const take = limit * COPIES_PER_NOTICE;
    const [found, unread] = await Promise.all([
      this.prisma.opsNotificationDelivery.findMany({
        where: this.ownDeliveries(actor), include: { notification: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: take + 1,
      }),
      this.unread(actor),
    ]);
    const rows = await this.withAccess(found.slice(0, take), actor);
    const eventIds = rows.flatMap((row) => row.notification.eventId ?? []);
    const names = eventIds.length ? await this.contacts.findEventNames(eventIds) : {};
    const grouped = groupInboxDeliveries(rows.map((row) => inboxDelivery(row, row.notification.eventId ? names[row.notification.eventId] ?? null : null)));
    return { items: grouped.slice(0, limit), unread, hasMore: found.length > take || grouped.length > limit };
  }

  /** How many notices the account has not opened yet, counting a notice sent on two channels once. */
  async unread(actor: PrismVerifiedEventActor): Promise<number> {
    const found = await this.prisma.opsNotificationDelivery.findMany({
      where: { ...this.ownDeliveries(actor), readAt: null }, include: { notification: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: UNREAD_SCAN_LIMIT,
    });
    const rows = await this.withAccess(found, actor);
    return groupInboxDeliveries(rows.map((row) => inboxDelivery(row, null))).length;
  }

  /** Marks every notice the account has as read; one the account has not yet opened never needs its own call. */
  async markAllRead(actor: PrismVerifiedEventActor): Promise<{ marked: number }> {
    const changed = await this.prisma.opsNotificationDelivery.updateMany({ where: { ...this.ownDeliveries(actor), readAt: null }, data: { readAt: new Date() } });
    return { marked: changed.count };
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
