import { ConflictException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import type { NotificationOutboxWriteInput, NotificationOutboxWriter } from '@prism/contexts/platform-ops';
import { LiveOpsOverdueTaskNotificationService } from './overdue-task-notification.service';
import { LiveOpsOverdueTaskNotificationScheduler } from './overdue-task-notification.scheduler';

const NOW = new Date('2026-10-19T10:00:00.000Z');

type TaskRow = {
  id: string;
  eventId: string;
  title: string;
  assignedRole: string;
  status: string;
  slaStatus: string;
  slaDueAt: Date | null;
  dueAt: Date | null;
  completedAt: Date | null;
};

function task(overrides: Partial<TaskRow> & Pick<TaskRow, 'id'>): TaskRow {
  return {
    eventId: 'evt_gala',
    title: 'Confirm stage power',
    assignedRole: 'Technical Lead',
    status: 'open',
    slaStatus: 'on_track',
    slaDueAt: new Date('2026-10-19T09:00:00.000Z'),
    dueAt: null,
    completedAt: null,
    ...overrides,
  };
}

/** Mirrors the outbox contract: one row per idempotency key, and a key stays bound to its original content. */
function createInMemoryOutbox() {
  const rows = new Map<string, NotificationOutboxWriteInput>();
  const writer: NotificationOutboxWriter = {
    write: vi.fn(async (input: NotificationOutboxWriteInput) => {
      const key = input.idempotencyKey ?? `anonymous:${rows.size}`;
      const existing = rows.get(key);
      if (existing) {
        if (existing.message !== input.message || existing.recipient !== input.recipient) {
          throw new ConflictException('Notification idempotency key is bound to different content');
        }
        return existing;
      }
      rows.set(key, input);
      return input;
    }),
  };
  return { rows, writer };
}

function createService(tasks: TaskRow[], options: { pmcmEmail?: string | null } = {}) {
  const prisma = {
    opsEventDayTask: {
      findMany: vi.fn(async ({ where }: { where: { id?: { gt: string } } }) =>
        tasks.filter((row) => !where.id || row.id > where.id.gt)),
    },
  };
  const outbox = createInMemoryOutbox();
  const accountContacts = {
    findApprovedEmailByRole: vi.fn(async () => (options.pmcmEmail === undefined ? ' Ops@PMCM.test ' : options.pmcmEmail)),
  };
  const policy = new EventAccessPolicyService({ write: vi.fn() } as never);
  const service = new LiveOpsOverdueTaskNotificationService(
    prisma as never,
    policy,
    outbox.writer,
    accountContacts as never,
  );
  return { service, policy, prisma, outbox };
}

describe('LiveOpsOverdueTaskNotificationService', () => {
  it('queues exactly one PMCM notice per overdue task across repeated sweeps', async () => {
    const tasks = [
      task({ id: 'edt_overdue' }),
      task({ id: 'edt_due_fallback', slaDueAt: null, dueAt: new Date('2026-10-19T08:30:00.000Z'), eventId: 'evt_summit' }),
      task({ id: 'edt_done', status: 'done', completedAt: new Date('2026-10-19T08:00:00.000Z') }),
      task({ id: 'edt_future', slaDueAt: new Date('2026-10-19T12:00:00.000Z') }),
    ];
    const { service, policy, outbox } = createService(tasks);
    const system = policy.resolveActor({ actorRole: OpsUserRole.System, actorName: 'System' });

    const first = await service.enqueueOverdueTaskNotifications(system, NOW);
    const second = await service.enqueueOverdueTaskNotifications(system, NOW);

    expect(first.queued.map((item) => item.taskId)).toEqual(['edt_overdue', 'edt_due_fallback']);
    expect(second.queued).toEqual(first.queued);
    expect([...outbox.rows.keys()]).toEqual([
      'live-ops-task-overdue:edt_overdue:2026-10-19T09:00:00.000Z',
      'live-ops-task-overdue:edt_due_fallback:2026-10-19T08:30:00.000Z',
    ]);
    expect([...outbox.rows.values()].every((row) => row.recipient === 'ops@pmcm.test')).toBe(true);
    expect(outbox.rows.get('live-ops-task-overdue:edt_due_fallback:2026-10-19T08:30:00.000Z')).toMatchObject({ eventId: 'evt_summit' });
  });

  it('notifies again only when a task is rescheduled, and keeps the original notice when a task is renamed', async () => {
    const tasks = [task({ id: 'edt_overdue' })];
    const { service, policy, outbox } = createService(tasks);
    const system = policy.resolveActor({ actorRole: OpsUserRole.System, actorName: 'System' });
    await service.enqueueOverdueTaskNotifications(system, NOW);

    tasks[0] = { ...tasks[0], title: 'Confirm generator power' };
    const renamed = await service.enqueueOverdueTaskNotifications(system, NOW);
    expect(renamed.skipped).toEqual([{ taskId: 'edt_overdue', reason: 'idempotency_conflict' }]);
    expect(outbox.rows.size).toBe(1);

    tasks[0] = { ...tasks[0], slaDueAt: new Date('2026-10-19T09:30:00.000Z') };
    await service.enqueueOverdueTaskNotifications(system, NOW);
    expect(outbox.rows.size).toBe(2);
  });

  it('queues nothing when no approved PMCM contact exists', async () => {
    const { service, policy, outbox } = createService([task({ id: 'edt_overdue' })], { pmcmEmail: null });
    const result = await service.enqueueOverdueTaskNotifications(policy.resolveActor({ actorRole: OpsUserRole.System, actorName: 'System' }), NOW);

    expect(result).toEqual({ recipient: null, queued: [], skipped: [] });
    expect(outbox.writer.write).not.toHaveBeenCalled();
  });

  it.each([OpsUserRole.Client, OpsUserRole.Supplier, OpsUserRole.Coordinator])('rejects %s actors before reading tasks', async (role) => {
    const { service, policy, prisma, outbox } = createService([task({ id: 'edt_overdue' })]);

    await expect(service.enqueueOverdueTaskNotifications(policy.resolveActor({ actorRole: role, actorName: 'Someone' }), NOW))
      .rejects.toThrow(/cannot access live-ops overdue task notifications/);
    expect(prisma.opsEventDayTask.findMany).not.toHaveBeenCalled();
    expect(outbox.writer.write).not.toHaveBeenCalled();
  });
});

describe('LiveOpsOverdueTaskNotificationScheduler', () => {
  const previous = process.env.PRISM_DISABLE_LIVE_OPS_OVERDUE_TASK_JOB;

  afterEach(() => {
    vi.useRealTimers();
    if (previous === undefined) delete process.env.PRISM_DISABLE_LIVE_OPS_OVERDUE_TASK_JOB;
    else process.env.PRISM_DISABLE_LIVE_OPS_OVERDUE_TASK_JOB = previous;
  });

  it('sweeps once per minute as a verified system actor unless disabled', async () => {
    vi.useFakeTimers();
    const enqueueOverdueTaskNotifications = vi.fn().mockResolvedValue(undefined);
    const service = { enqueueOverdueTaskNotifications } as unknown as LiveOpsOverdueTaskNotificationService;

    delete process.env.PRISM_DISABLE_LIVE_OPS_OVERDUE_TASK_JOB;
    const enabled = new LiveOpsOverdueTaskNotificationScheduler(service);
    enabled.onModuleInit();
    await vi.advanceTimersByTimeAsync(60_000);
    enabled.onModuleDestroy();
    expect(enqueueOverdueTaskNotifications).toHaveBeenCalledTimes(1);
    expect(enqueueOverdueTaskNotifications).toHaveBeenCalledWith(expect.objectContaining({
      role: OpsUserRole.System,
      explicit: true,
      verified: true,
    }));

    process.env.PRISM_DISABLE_LIVE_OPS_OVERDUE_TASK_JOB = '1';
    const disabled = new LiveOpsOverdueTaskNotificationScheduler(service);
    disabled.onModuleInit();
    await vi.advanceTimersByTimeAsync(60_000);
    disabled.onModuleDestroy();
    expect(enqueueOverdueTaskNotifications).toHaveBeenCalledTimes(1);
  });
});
