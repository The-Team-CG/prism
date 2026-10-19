import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { LiveOpsSlaStatus, OpsUserRole } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter } from '@prism/contexts/platform-ops';
import { ACCOUNT_CONTACT_READ_MODEL, type AccountContactReadModel } from '@prism/contexts/read-models/account-contacts';
import { computeSlaStatus } from '../domain/live-ops-sla.policy';

const SWEEP_PAGE_SIZE = 500;
/** Tasks overdue for longer than this are left to the command inbox instead of producing new notifications. */
export const OVERDUE_TASK_NOTIFICATION_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export type OverdueTaskNotificationResult = {
  recipient: string | null;
  queued: Array<{ taskId: string; idempotencyKey: string }>;
  skipped: Array<{ taskId: string; reason: 'idempotency_conflict' }>;
};

/** Stable per task and due time: re-running the sweep never queues a second notice, while a rescheduled task can notify again. */
export function overdueTaskNotificationKey(taskId: string, dueAt: Date) {
  return `live-ops-task-overdue:${taskId}:${dueAt.toISOString()}`;
}

/**
 * Queues one PMCM owner notification per overdue event-day task through the notification outbox.
 * Queue-only: delivery stays with the outbox worker and its configured provider.
 */
@Injectable()
export class LiveOpsOverdueTaskNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessPolicyService,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    @Inject(ACCOUNT_CONTACT_READ_MODEL) private readonly accountContacts: AccountContactReadModel,
  ) {}

  async enqueueOverdueTaskNotifications(actor: ResolvedEventOpsActor, now = new Date()): Promise<OverdueTaskNotificationResult> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'live-ops overdue task notifications');
    const recipient = await this.resolvePmcmRecipient();
    const result: OverdueTaskNotificationResult = { recipient, queued: [], skipped: [] };
    if (!recipient) return result;

    const since = new Date(now.getTime() - OVERDUE_TASK_NOTIFICATION_LOOKBACK_MS);
    let cursorAfter: string | undefined;
    while (true) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: stable ID keyset pages the overdue window in batches of 500.
      const tasks = await this.prisma.opsEventDayTask.findMany({
        where: {
          ...(cursorAfter ? { id: { gt: cursorAfter } } : {}),
          status: { notIn: ['done', 'cancelled'] },
          completedAt: null,
          OR: [
            { slaDueAt: { gte: since, lt: now } },
            { slaDueAt: null, dueAt: { gte: since, lt: now } },
          ],
        },
        select: { id: true, eventId: true, title: true, assignedRole: true, status: true, slaStatus: true, slaDueAt: true, dueAt: true, completedAt: true },
        orderBy: { id: 'asc' },
        take: SWEEP_PAGE_SIZE,
      });
      for (const task of tasks) {
        const dueAt = task.slaDueAt ?? task.dueAt;
        if (!dueAt || computeSlaStatus(task, now) !== LiveOpsSlaStatus.Overdue) continue;
        const idempotencyKey = overdueTaskNotificationKey(task.id, dueAt);
        try {
          await this.notificationOutboxWriter.write({
            eventId: task.eventId,
            recipient,
            message: `Overdue event-day task: ${task.title} (${task.assignedRole}). Review it in the PMCM command inbox.`,
            channel: 'email',
            correlationId: idempotencyKey,
            idempotencyKey,
          });
          result.queued.push({ taskId: task.id, idempotencyKey });
        } catch (error) {
          // The task was renamed after its notice was queued; the existing notice stands.
          if (!(error instanceof ConflictException)) throw error;
          result.skipped.push({ taskId: task.id, reason: 'idempotency_conflict' });
        }
      }
      if (tasks.length < SWEEP_PAGE_SIZE) break;
      cursorAfter = tasks[tasks.length - 1].id;
    }
    return result;
  }

  private async resolvePmcmRecipient() {
    const email = await this.accountContacts.findApprovedEmailByRole(OpsUserRole.PmcmAdmin);
    const normalized = email?.trim().toLowerCase();
    return normalized?.includes('@') ? normalized : null;
  }
}
