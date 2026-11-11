import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { OpsNotificationDelivery, OpsNotificationLog, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, writeAudit, type AuditWriter } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import { eventSectionAction } from '../../contracts/notifications/notification-outbox-writer.port';
import { NotificationOutboxService } from './notification-outbox.service';
import { secondEscalationWindowMs } from './notification-escalation.policy';

@Injectable()
export class NotificationEscalationService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(NotificationEscalationService.name);
  constructor(private readonly prisma: PrismaService, private readonly outbox: NotificationOutboxService, @Inject(AUDIT_WRITER) private readonly audit: AuditWriter) {}
  onApplicationBootstrap() {
    if (process.env.PRISM_DISABLE_NOTIFICATION_ESCALATION_JOB === '1' || process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => { void this.sweep(); }, 60_000); this.timer.unref();
    void this.sweep();
  }
  onApplicationShutdown() { if (this.timer) clearInterval(this.timer); }
  private async sweep() {
    if (this.running) return;
    this.running = true;
    try { await this.escalateDue(); } catch { this.logger.warn('Notification escalation sweep failed; durable work remains pending'); }
    finally { this.running = false; }
  }
  /**
   * Two levels. A recipient whose acknowledgment deadline passed is escalated to PMCM; one still silent a window later
   * (PRISM_NOTIFICATION_SECOND_ESCALATION_HOURS, default 24) is chased once more, PMCM again and the event's coordinators.
   * Each level happens at most once per deadline, however many sweeps or API instances run.
   */
  async escalateDue(now = new Date()) {
    const escalated = await this.escalateOverdue(now);
    const secondEscalated = await this.escalateUnanswered(now);
    await this.prisma.opsNotificationProviderOutcome.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60_000) } } });
    return { escalated, secondEscalated };
  }

  private async escalateOverdue(now: Date) {
    const rows =await this.prisma.opsNotificationDelivery.findMany({ where: { acknowledgedAt: null, escalatedAt: null, acknowledgmentDueAt: { lte: now } }, include: { notification: true }, orderBy: [{ acknowledgmentDueAt: 'asc' }, { id: 'asc' }], take: 50 });
    let escalated = 0;
    for (const row of rows) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: at most 50 overdue recipient deadlines per sweep.
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.opsNotificationDelivery.updateMany({ where: { id: row.id, acknowledgedAt: null, escalatedAt: null, acknowledgmentDueAt: row.acknowledgmentDueAt }, data: { escalatedAt: now } });
        if (!changed.count) return;
        const key = `notification-escalation:${row.id}:${row.acknowledgmentDueAt!.toISOString()}`;
        await this.outbox.queue(row.notification.eventId ?? undefined, 'PMCM Admin', `An operational notice has an overdue acknowledgment from ${row.recipient}. Review the notification delivery details in the event workspace.`, 'email', { idempotencyKey: key, ...(row.notification.eventId ? { action: eventSectionAction(row.notification.eventId, 'billing') } : {}) }, { prisma: tx, correlationId: key });
        await writeAudit(this.audit, row.notification.eventId ?? undefined, 'System', 'Escalated overdue notification acknowledgment', { actorRole: 'system', actionType: AuditActionType.Update, category: AuditCategory.Events, affectedType: 'notification_delivery', affectedId: row.id }, { prisma: tx, correlationId: key });
        escalated += 1;
      });
    }
    return escalated;
  }

  /** A recipient still silent a window after the first escalation: chase once more, PMCM and the event's coordinators. */
  private async escalateUnanswered(now: Date) {
    const cutoff = new Date(now.getTime() - secondEscalationWindowMs(process.env.PRISM_NOTIFICATION_SECOND_ESCALATION_HOURS));
    const rows = await this.prisma.opsNotificationDelivery.findMany({
      where: { acknowledgedAt: null, secondEscalatedAt: null, escalatedAt: { lte: cutoff } },
      include: { notification: true },
      orderBy: [{ escalatedAt: 'asc' }, { id: 'asc' }],
      take: 50,
    });
    let chased = 0;
    for (const row of rows) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: at most 50 unanswered escalations per sweep.
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.opsNotificationDelivery.updateMany({
          where: { id: row.id, acknowledgedAt: null, secondEscalatedAt: null, escalatedAt: row.escalatedAt },
          data: { secondEscalatedAt: now },
        });
        if (!changed.count) return;
        await this.queueSecondEscalation(tx, row);
        chased += 1;
      });
    }
    return chased;
  }

  private async queueSecondEscalation(tx: Prisma.TransactionClient, row: OpsNotificationDelivery & { notification: OpsNotificationLog }) {
    const eventId = row.notification.eventId ?? undefined;
    // The first escalation's time identifies this deadline: a new deadline clears it and so earns its own chase.
    const key = `notification-escalation-2:${row.id}:${row.escalatedAt!.toISOString()}`;
    const context = { prisma: tx, correlationId: key };
    await this.outbox.queue(eventId, 'PMCM Admin', `${row.recipient} has still not acknowledged an operational notice since PMCM was alerted. Follow up with them, or review the delivery details in the event workspace.`, 'email', { idempotencyKey: `${key}:pmcm`, ...(eventId ? { action: eventSectionAction(eventId, 'billing') } : {}) }, context);
    // Coordinators are the backup who can reach the recipient on the ground; a notice with no event has none to address.
    if (eventId) await this.outbox.queue(eventId, 'Coordinator', `${row.recipient} has not acknowledged an operational notice for this event and PMCM has already been alerted. Please follow up with them directly.`, 'email', { idempotencyKey: `${key}:coordinator`, action: eventSectionAction(eventId, 'overview') }, context);
    await writeAudit(this.audit, eventId, 'System', 'Escalated unanswered notification acknowledgment a second time', { actorRole: 'system', actionType: AuditActionType.Update, category: AuditCategory.Events, affectedType: 'notification_delivery', affectedId: row.id }, context);
  }
}
