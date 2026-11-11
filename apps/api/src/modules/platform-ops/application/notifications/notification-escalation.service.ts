import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, writeAudit, type AuditWriter } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import { NotificationOutboxService } from './notification-outbox.service';

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
  async escalateDue(now = new Date()) {
    const rows = await this.prisma.opsNotificationDelivery.findMany({ where: { acknowledgedAt: null, escalatedAt: null, acknowledgmentDueAt: { lte: now } }, include: { notification: true }, orderBy: [{ acknowledgmentDueAt: 'asc' }, { id: 'asc' }], take: 50 });
    let escalated = 0;
    for (const row of rows) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: at most 50 overdue recipient deadlines per sweep.
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.opsNotificationDelivery.updateMany({ where: { id: row.id, acknowledgedAt: null, escalatedAt: null, acknowledgmentDueAt: row.acknowledgmentDueAt }, data: { escalatedAt: now } });
        if (!changed.count) return;
        const key = `notification-escalation:${row.id}:${row.acknowledgmentDueAt!.toISOString()}`;
        await this.outbox.queue(row.notification.eventId ?? undefined, 'PMCM Admin', `An operational notice has an overdue acknowledgment from ${row.recipient}. Review the notification delivery details in the event workspace.`, 'email', { idempotencyKey: key }, { prisma: tx, correlationId: key });
        await writeAudit(this.audit, row.notification.eventId ?? undefined, 'System', 'Escalated overdue notification acknowledgment', { actorRole: 'system', actionType: AuditActionType.Update, category: AuditCategory.Events, affectedType: 'notification_delivery', affectedId: row.id }, { prisma: tx, correlationId: key });
        escalated += 1;
      });
    }
    await this.prisma.opsNotificationProviderOutcome.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60_000) } } });
    return { escalated };
  }
}
