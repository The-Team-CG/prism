import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { NotificationOutboxService } from './notification-outbox.service';
import { processNotificationQueue } from './notification-delivery-worker';
import type { NotificationDeliveryPort } from '../../contracts/notifications/notification-delivery.port';

function createService(options: { encryptionKey?: string; delivery?: NotificationDeliveryPort } = {}) {
  const notifications: Array<Record<string, unknown>> = [];
  const prisma = {
    opsNotificationLog: {
      findFirst: vi.fn(async ({ where }: { where: { correlationId?: string } }) =>
        notifications.find((notification) => notification.correlationId === where.correlationId && notification.idempotencyKey == null) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const record = { ...data, createdAt: new Date('2026-05-01T08:00:00.000Z') };
        notifications.push(record);
        return record;
      }),
      upsert: vi.fn(async ({ where, create }: { where: { idempotencyKey: string }; create: Record<string, unknown> }) => {
        const existing = notifications.find((row) => row.idempotencyKey === where.idempotencyKey);
        if (existing) return existing;
        const record = { ...create, createdAt: new Date() };
        notifications.push(record);
        return record;
      }),
      findMany: vi.fn(async ({ where }: { where: { status: string } }) =>
        notifications.filter((notification) => notification.status === where.status),
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        notifications.find((notification) => notification.id === where.id) ?? null,
      ),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const found = notifications.find((notification) => notification.id === where.id);
        if (!found) throw new Error('Missing notification');
        return found;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: any; data: Record<string, unknown> }) => {
        const matchesCondition = (condition: any, value: unknown) => condition && typeof condition === 'object' && 'not' in condition
          ? value !== condition.not
          : value === condition;
        const matches = notifications.filter((row) => (where.id === undefined || row.id === where.id)
          && (where.eventId === undefined || row.eventId === where.eventId)
          && (where.status === undefined || row.status === where.status)
          && (where.guestPassId === undefined || matchesCondition(where.guestPassId, row.guestPassId))
          && (where.sensitivePayload === undefined || matchesCondition(where.sensitivePayload, row.sensitivePayload))
          && (where.leaseToken === undefined || row.leaseToken === where.leaseToken));
        matches.forEach((row) => Object.assign(row, data));
        return { count: matches.length };
      }),
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
    service: new NotificationOutboxService(
      prisma as never,
      options.delivery,
      new ConfigService(options.encryptionKey ? { GUEST_QR_DELIVERY_ENCRYPTION_KEY: options.encryptionKey } : {}),
    ),
  };
}

const deliveryDiagnosticCases: Array<{
  label: string;
  delivery: NotificationDeliveryPort | undefined;
  failureReason: string | null;
}> = [
  { label: 'no adapter', delivery: undefined, failureReason: 'Delivery provider is not configured' },
  {
    label: 'capture adapter',
    delivery: { deliveryMode: 'capture', deliver: async () => ({ status: 'captured', receipt: 'capture_receipt' }) },
    failureReason: 'Delivery provider is not configured',
  },
  {
    label: 'provider adapter',
    delivery: { deliveryMode: 'provider', deliver: async () => ({ status: 'accepted', receipt: 'provider_receipt' }) },
    failureReason: null,
  },
];

describe('NotificationOutboxService', () => {
  it('delivers and retains queued evidence when its optional event reference is absent', async () => {
    const row: Record<string, any> = {
      id: 'not_orphaned_event', eventId: 'evt_retired', channel: 'email', recipient: 'trust@example.test', message: 'Audit review required',
      status: 'queued', attempts: 0, nextAttemptAt: new Date(Date.now() - 1_000), leaseToken: null, leaseExpiresAt: null,
      createdAt: new Date(),
    };
    const prisma = {
      opsNotificationLog: {
        findMany: vi.fn(async () => [row]),
        updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(row, data);
          return { count: 1 };
        }),
        findUnique: vi.fn(async () => row),
      },
    };
    const delivery = { deliveryMode: 'provider' as const, deliver: vi.fn(async () => ({ status: 'accepted' as const, receipt: 'provider-receipt' })) };

    const processed = await processNotificationQueue(prisma as never, delivery);

    expect(processed[0]).toMatchObject({ id: row.id, eventId: 'evt_retired', status: 'sent', providerReceipt: 'provider-receipt' });
    expect(prisma.opsNotificationLog.updateMany).toHaveBeenCalledTimes(2);
  });

  it.each(['queued', 'failed'])('rejects acknowledgement of %s work', async (status) => {
    const { service, notifications } = createService();
    notifications.push({ id: 'not_1', recipient: 'client@example.test', status });
    await expect(service.acknowledge('not_1', { role: 'client', email: 'client@example.test' } as never)).rejects.toThrow(/provider-accepted/);
    expect(notifications[0].status).toBe(status);
  });
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

  it.each(deliveryDiagnosticCases)(
    'persists queued notification work with the correct delivery diagnostic for $label',
    async ({ delivery, failureReason }) => {
      const { notifications, prisma, service } = createService({ delivery });

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
        failureReason,
      });
      expect(notifications[0]).toMatchObject({ status: 'queued', failureReason });
      expect(prisma.opsNotificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          correlationId: 'audit_123',
          status: 'queued',
          attempts: 0,
          failureReason,
        }),
      });
    },
  );

  it('rejects an idempotency key reused for different message content', async () => {
    const { service, notifications } = createService();
    await service.queue('evt_1', 'client@example.test', 'Original', 'email', { idempotencyKey: 'same-key' });
    await expect(service.queue('evt_1', 'client@example.test', 'Changed', 'email', { idempotencyKey: 'same-key' })).rejects.toThrow(/different content/);
    expect(notifications).toHaveLength(1);
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
    expect(prisma.opsNotificationLog.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { idempotencyKey: 'notif-key-1' } }));
    expect(prisma.opsNotificationLog.create).not.toHaveBeenCalled();
  });

  it('stores guest pass content only as ciphertext and returns sanitized queue status', async () => {
    const encryptionKey = Buffer.alloc(32, 17).toString('base64');
    const delivery: NotificationDeliveryPort = {
      deliveryMode: 'capture',
      deliver: async () => ({ status: 'captured', receipt: 'capture_receipt_1' }),
    };
    const { notifications, service } = createService({ encryptionKey, delivery });
    const plaintextMessage = 'Open https://guest.prism.test/e/EVT-DEMO#pass=high-entropy-secret';

    const result = await service.writeGuestPassDelivery({
      eventId: 'evt_synthetic',
      passId: 'pass_1',
      recipient: 'guest@example.test',
      plaintextMessage,
      idempotencyKey: 'guest-pass:pass_1:issue_1',
    });

    expect(result).toMatchObject({ status: 'queued' });
    expect(JSON.stringify(result)).not.toContain(plaintextMessage);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      eventId: 'evt_synthetic',
      guestPassId: 'pass_1',
      recipient: 'guest@example.test',
      message: '[Guest pass delivery]',
      status: 'queued',
    });
    expect(notifications[0].sensitivePayload).toEqual(expect.any(String));
    expect(notifications[0].sensitivePayload).not.toContain(plaintextMessage);
  });

  it('fails closed without the managed encryption key before writing a guest pass notification', async () => {
    const delivery: NotificationDeliveryPort = {
      deliveryMode: 'capture',
      deliver: async () => ({ status: 'captured', receipt: 'capture_receipt_1' }),
    };
    const { notifications, prisma, service } = createService({ delivery });

    await expect(service.writeGuestPassDelivery({
      eventId: 'evt_synthetic',
      passId: 'pass_1',
      recipient: 'guest@example.test',
      plaintextMessage: 'secret pass URL',
      idempotencyKey: 'guest-pass:pass_1:issue_1',
    })).rejects.toThrow(/guest pass delivery is not available/i);

    expect(notifications).toHaveLength(0);
    expect(prisma.opsNotificationLog.upsert).not.toHaveBeenCalled();
    expect(prisma.opsNotificationLog.create).not.toHaveBeenCalled();
  });

  it.each([
    ['missing delivery adapter', undefined],
    ['provider-mode delivery adapter', { deliveryMode: 'provider' as const, deliver: async () => ({ status: 'accepted' as const, receipt: 'provider_receipt' }) }],
  ])('refuses guest pass queueing with a %s', async (_label, delivery) => {
    const encryptionKey = Buffer.alloc(32, 17).toString('base64');
    const { notifications, service } = createService({ encryptionKey, delivery });

    await expect(service.writeGuestPassDelivery({
      eventId: 'evt_synthetic',
      passId: 'pass_1',
      recipient: 'guest@example.test',
      plaintextMessage: 'secret pass URL',
      idempotencyKey: 'guest-pass:pass_1:issue_1',
    })).rejects.toThrow(/capture-only/i);

    expect(notifications).toHaveLength(0);
  });

  it('cancels queued guest-pass delivery and clears its encrypted payload', async () => {
    const { notifications, service } = createService();
    notifications.push({
      id: 'not_guest_pass',
      guestPassId: 'pass_1',
      sensitivePayload: 'v1.ciphertext',
      status: 'queued',
      leaseToken: 'lease_current',
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });

    await service.cancelGuestPassDelivery('not_guest_pass');

    expect(notifications[0]).toMatchObject({
      status: 'cancelled',
      sensitivePayload: null,
      leaseToken: null,
      leaseExpiresAt: null,
    });
  });

  it('bulk-cancels queued guest-pass deliveries only for the closing event', async () => {
    const { notifications, service } = createService();
    notifications.push(
      { id: 'not_event_guest', eventId: 'evt_1', guestPassId: 'pass_1', sensitivePayload: 'v1.one', status: 'queued', leaseToken: 'lease_1', leaseExpiresAt: new Date() },
      { id: 'not_event_ordinary', eventId: 'evt_1', guestPassId: null, sensitivePayload: null, status: 'queued' },
      { id: 'not_other_event', eventId: 'evt_2', guestPassId: 'pass_2', sensitivePayload: 'v1.two', status: 'queued' },
      { id: 'not_event_sent', eventId: 'evt_1', guestPassId: 'pass_3', sensitivePayload: 'v1.three', status: 'sent' },
    );

    await service.cancelGuestPassDeliveriesForEvent('evt_1');

    expect(notifications[0]).toMatchObject({ status: 'cancelled', sensitivePayload: null, leaseToken: null, leaseExpiresAt: null });
    expect(notifications.slice(1)).toMatchObject([
      { status: 'queued', eventId: 'evt_1', guestPassId: null },
      { status: 'queued', eventId: 'evt_2', guestPassId: 'pass_2' },
      { status: 'sent', eventId: 'evt_1', guestPassId: 'pass_3' },
    ]);
  });

  it('retries queued guest-pass delivery only when its encrypted body remains available and unleased', async () => {
    const { notifications, service } = createService();
    const originalAttempt = new Date('2026-10-16T12:00:00.000Z');
    notifications.push({
      id: 'not_guest_pass', guestPassId: 'pass_1', sensitivePayload: 'v1.ciphertext', status: 'queued',
      attempts: 3, nextAttemptAt: originalAttempt, failureReason: 'temporary provider failure', failedAt: originalAttempt,
      leaseToken: null, leaseExpiresAt: null,
    });

    await service.retryGuestPassDelivery('not_guest_pass');

    expect(notifications[0]).toMatchObject({
      guestPassId: 'pass_1', sensitivePayload: 'v1.ciphertext', status: 'queued',
      failureReason: null, failedAt: null, leaseToken: null,
    });
    expect(notifications[0].nextAttemptAt).toBeInstanceOf(Date);
    expect((notifications[0].nextAttemptAt as Date).getTime()).toBeGreaterThan(originalAttempt.getTime());
  });

  it.each([
    ['captured', { status: 'captured' }],
    ['redacted', { sensitivePayload: null }],
    ['leased', { leaseToken: 'lease_current' }],
    ['unlinked', { guestPassId: null }],
  ])('rejects retry of a %s guest-pass notification', async (_label, overrides) => {
    const { notifications, service } = createService();
    notifications.push({
      id: 'not_guest_pass', guestPassId: 'pass_1', sensitivePayload: 'v1.ciphertext', status: 'queued',
      leaseToken: null, leaseExpiresAt: null, ...overrides,
    });

    await expect(service.retryGuestPassDelivery('not_guest_pass')).rejects.toThrow('Guest pass delivery cannot be retried');
  });
});
