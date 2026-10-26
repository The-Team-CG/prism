import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import type { Prisma } from '@prisma/client';
import { NotificationOutboxService } from '../../src/modules/platform-ops/application/notifications/notification-outbox.service';
import type { NotificationDeliveryPort } from '../../src/modules/platform-ops/contracts/notifications/notification-delivery.port';

const url = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(url && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(url));
if (url && !live) throw new Error('Notification tests require isolated 127.0.0.1:55437/prism_p0');

describe.skipIf(!live)('durable notification delivery', () => {
  it('claims once, binds content and retries with provider idempotency', async () => {
    const prisma = new PrismaService();
    const prefix = `p1_delivery_${randomUUID()}`;
    // Scope queue enumeration to this fixture; all persistence/claim operations use real PostgreSQL.
    const fixturePrisma = new Proxy(prisma, { get(target, property) {
      if (property !== 'opsNotificationLog') return Reflect.get(target, property);
      return new Proxy(target.opsNotificationLog, { get(delegate, method) {
        if (method !== 'findMany') return Reflect.get(delegate, method);
        return (args: Prisma.OpsNotificationLogFindManyArgs) => delegate.findMany({ ...args, where: { AND: [args.where ?? {}, { idempotencyKey: { startsWith: prefix } }] } });
      } });
    } });
    const service = new NotificationOutboxService(fixturePrisma, { deliver: vi.fn() });
    try {
      const [first, replay] = await Promise.all([
        service.queue(undefined, 'fixture@example.test', 'Test', 'email', { idempotencyKey: prefix }),
        service.queue(undefined, 'fixture@example.test', 'Test', 'email', { idempotencyKey: prefix }),
      ]);
      expect(first.id).toBe(replay.id);
      await expect(service.queue(undefined, 'different@example.test', 'Test', 'email', { idempotencyKey: prefix })).rejects.toThrow(/different content/);
      await prisma.opsNotificationLog.update({ where: { id: first.id }, data: { nextAttemptAt: new Date(0) } });
      const deliver = vi.fn<NotificationDeliveryPort['deliver']>().mockResolvedValue({ status: 'retryable_failure' });
      const worker = new NotificationOutboxService(fixturePrisma, { deliver });
      await Promise.all([worker.processQueued(), worker.processQueued()]);
      expect(deliver).toHaveBeenCalledTimes(1);
      expect(await prisma.opsNotificationLog.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ status: 'queued', attempts: 1, sentAt: null });
      expect(await worker.processQueued()).toEqual([]);
      const failureAdapters: NotificationDeliveryPort[] = [
        { deliver: async () => ({ status: 'permanent_failure', reason: 'provider refused' }) },
        { deliver: async () => ({ status: 'accepted', receipt: '' }) },
        { deliver: async () => { throw new Error('private provider diagnostic'); } },
      ];
      const failureReasons = ['provider refused', 'Delivery failed; operator review required', 'Delivery failed; operator review required'];
      for (const [index, adapter] of failureAdapters.entries()) {
        const row = await service.queue(undefined, 'fixture@example.test', 'Failure test', 'email', { idempotencyKey: `${prefix}_${index}` });
        const failed = await new NotificationOutboxService(fixturePrisma, adapter).processQueued({ maxAttempts: 1 });
        expect(failed[0]).toMatchObject({ id: row.id, status: 'failed', attempts: 1, sentAt: null, providerReceipt: null, failureReason: failureReasons[index] });
        await expect(service.acknowledge(row.id)).rejects.toThrow(/provider-accepted/);
      }
      await prisma.opsNotificationLog.update({ where: { id: first.id }, data: { nextAttemptAt: new Date(0), leaseToken: 'crashed-worker', leaseExpiresAt: new Date(0) } });
      deliver.mockResolvedValue({ status: 'accepted', receipt: 'test-provider-receipt' });
      expect((await worker.processQueued())[0]).toMatchObject({ status: 'sent', attempts: 2, providerReceipt: 'test-provider-receipt', leaseToken: null });
      expect(deliver.mock.calls.map(([input]) => input.idempotencyKey)).toEqual([first.id, first.id]);
      expect(await worker.processQueued()).toEqual([]);
      expect(await service.acknowledge(first.id)).toMatchObject({ status: 'acknowledged' });
      expect(await service.acknowledge(first.id)).toMatchObject({ status: 'acknowledged' });
    } finally {
      await prisma.opsNotificationLog.deleteMany({ where: { idempotencyKey: { startsWith: prefix } } });
      await prisma.$disconnect();
    }
  });
});
