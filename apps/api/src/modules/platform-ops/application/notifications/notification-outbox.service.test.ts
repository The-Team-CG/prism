import { describe, expect, it, vi } from 'vitest';
import { NotificationOutboxService } from './notification-outbox.service';

function createService() {
  const notifications: Array<Record<string, unknown>> = [];
  const prisma = {
    opsNotificationLog: {
      findFirst: vi.fn(async ({ where }: { where: { correlationId?: string } }) =>
        notifications.find((notification) => notification.correlationId === where.correlationId) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const record = { ...data, createdAt: new Date('2026-05-01T08:00:00.000Z') };
        notifications.push(record);
        return record;
      }),
      findMany: vi.fn(async ({ where }: { where: { status: string } }) =>
        notifications.filter((notification) => notification.status === where.status),
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        notifications.find((notification) => notification.id === where.id) ?? null,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = notifications.findIndex((notification) => notification.id === where.id);
        if (index === -1) throw new Error('Notification not found');
        notifications[index] = { ...notifications[index], ...data };
        return notifications[index];
      }),
    },
  };

  return {
    notifications,
    prisma,
    service: new NotificationOutboxService(prisma as never),
  };
}

describe('NotificationOutboxService', () => {
  it('allows a verified recipient to acknowledge only their own notification', async () => {
    const { service, notifications } = createService();
    notifications.push({ id: 'not_1', recipient: 'client@example.test', status: 'sent' });
    const actor = { email: 'CLIENT@example.test', role: 'client' } as never;
    await expect(service.acknowledge('not_1', actor)).resolves.toMatchObject({ status: 'acknowledged' });
  });

  it('denies a verified actor acknowledging another recipient notification', async () => {
    const { service, notifications } = createService();
    notifications.push({ id: 'not_1', recipient: 'client@example.test', status: 'sent' });
    const actor = { email: 'other@example.test', role: 'client' } as never;
    await expect(service.acknowledge('not_1', actor)).rejects.toThrow(/recipient/);
  });

  it('denies a recipient acknowledging a notification from another event scope', async () => {
    const { service, notifications } = createService();
    notifications.push({ id: 'not_1', eventId: 'evt_other', recipient: 'client@example.test', status: 'sent' });
    const actor = { email: 'client@example.test', role: 'client', eventId: 'evt_current' } as never;
    await expect(service.acknowledge('not_1', actor)).rejects.toThrow(/event scope/);
  });

  it('persists audit correlation when queueing notification work', async () => {
    const { prisma, service } = createService();

    const queued = await service.queue('evt_1', 'client@example.test', 'Conforme ready', 'email', {
      correlationId: 'audit_123',
    });

    expect(queued).toMatchObject({
      eventId: 'evt_1',
      channel: 'email',
      recipient: 'client@example.test',
      message: 'Conforme ready',
      status: 'queued',
      attempts: 0,
      correlationId: 'audit_123',
    });
    expect(prisma.opsNotificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        correlationId: 'audit_123',
        status: 'queued',
        attempts: 0,
      }),
    });
  });

  it('retries forced adapter failures until terminal failure', async () => {
    const { service } = createService();
    await service.queue('evt_1', 'pmcm@example.test', 'Sync integration payload', 'email', { forceFail: true });

    const firstAttempt = await service.processQueued({ maxAttempts: 2 });
    const secondAttempt = await service.processQueued({ maxAttempts: 2 });
    const thirdAttempt = await service.processQueued({ maxAttempts: 2 });

    expect(firstAttempt[0]).toMatchObject({
      status: 'queued',
      attempts: 1,
      failureReason: 'FORCE_FAIL: Sample adapter forced failure (1/2)',
    });
    expect(secondAttempt[0]).toMatchObject({
      status: 'failed',
      attempts: 2,
      failureReason: 'FORCE_FAIL: Sample adapter forced failure (2/2)',
    });
    expect(thirdAttempt).toEqual([]);
  });
  it('uses an idempotency key to avoid duplicate queued notification work', async () => {
    const { notifications, prisma, service } = createService();

    const first = await service.queue('evt_1', 'client@example.test', 'Conforme ready', 'email', {
      idempotencyKey: 'notif-key-1',
    });
    const second = await service.queue('evt_1', 'client@example.test', 'Conforme ready', 'email', {
      idempotencyKey: 'notif-key-1',
    });

    expect(second).toBe(first);
    expect(notifications).toHaveLength(1);
    expect(prisma.opsNotificationLog.findFirst).toHaveBeenCalledWith({
      where: { correlationId: 'notif-key-1' },
    });
    expect(prisma.opsNotificationLog.create).toHaveBeenCalledTimes(1);
  });
});
