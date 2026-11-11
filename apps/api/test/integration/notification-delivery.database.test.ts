import { createHmac, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import type { Prisma } from '@prisma/client';
import { NotificationOutboxService } from '../../src/modules/platform-ops/application/notifications/notification-outbox.service';
import type { NotificationDeliveryPort } from '../../src/modules/platform-ops/contracts/notifications/notification-delivery.port';
import { NotificationRecipientDeliveryService } from '../../src/modules/platform-ops/application/notifications/notification-recipient-delivery.service';
import { NotificationInboxService } from '../../src/modules/platform-ops/application/notifications/notification-inbox.service';
import { NotificationPreferenceService } from '../../src/modules/platform-ops/application/notifications/notification-preference.service';
import { NotificationProviderOutcomeService } from '../../src/modules/platform-ops/application/notifications/notification-provider-outcome.service';
import { ViberBotClient } from '../../src/modules/platform-ops/infrastructure/notifications/viber-bot.client';
import { NotificationEscalationService } from '../../src/modules/platform-ops/application/notifications/notification-escalation.service';

const url = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(url && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(url));
if (url && !live) throw new Error('Notification tests require isolated 127.0.0.1:55437/prism_p0');

describe.skipIf(!live)('durable notification delivery', () => {
  it('reconciles signed Viber callbacks arriving before acceptance without rounding or status regression', async () => {
    const prisma = new PrismaService();
    const token = '4912661846655238145';
    const secret = 'isolated-viber-test-secret';
    const bot = new ViberBotClient({ authToken: secret, botUri: 'test', senderName: 'Test' });
    const preferences = new NotificationPreferenceService(prisma, bot);
    const outcomes = new NotificationProviderOutcomeService(prisma, {} as never);
    const row = await new NotificationOutboxService(prisma, { deliver: vi.fn() }).queue(undefined, 'viber@example.test', 'Test', 'viber');
    async function callback(event: string) {
      const raw = Buffer.from(`{"event":"${event}","message_token":${token}}`);
      const signature = createHmac('sha256', secret).update(raw).digest('hex');
      await preferences.handleViberCallback(raw, signature);
    }
    try {
      const raw = Buffer.from(`{"event":"seen","message_token":${token}}`);
      await expect(preferences.handleViberCallback(raw, '0'.repeat(64))).rejects.toThrow('signature');
      expect(await prisma.opsNotificationProviderOutcome.count({ where: { receipt: token } })).toBe(0);
      await callback('seen');
      await new NotificationRecipientDeliveryService(prisma, outcomes).deliver(row.id, async () => ({ status: 'resolved', addresses: ['viber@example.test'] }), async () => ({ status: 'accepted', receipt: token }));
      await callback('delivered');
      expect(await prisma.opsNotificationDelivery.findFirstOrThrow({ where: { notificationId: row.id } })).toMatchObject({ providerReceipt: token, providerOutcome: 'seen', acknowledgedAt: null });
      await callback('failed'); await callback('seen');
      expect(await prisma.opsNotificationDelivery.findFirstOrThrow({ where: { notificationId: row.id } })).toMatchObject({ providerOutcome: 'failed', acknowledgedAt: null });
    } finally {
      await prisma.opsNotificationLog.delete({ where: { id: row.id } });
      await prisma.opsNotificationProviderOutcome.deleteMany({ where: { receipt: token } });
      await prisma.$disconnect();
    }
  });
  it('applies pushed email events before and after acceptance, and never lets a later report undo a further-along one', async () => {
    const prisma = new PrismaService();
    const receipt = randomUUID();
    const outcomes = new NotificationProviderOutcomeService(prisma, {} as never);
    const row = await new NotificationOutboxService(prisma, { deliver: vi.fn() }).queue(undefined, 'resend@example.test', 'Test');
    const delivery = () => prisma.opsNotificationDelivery.findFirstOrThrow({ where: { notificationId: row.id } });
    try {
      // The provider can report before the send response is recorded; the report waits for acceptance.
      await outcomes.recordEmailOutcome(receipt, 'delivered');
      await new NotificationRecipientDeliveryService(prisma, outcomes).deliver(row.id, async () => ({ status: 'resolved', addresses: ['resend@example.test'] }), async () => ({ status: 'accepted', receipt }));
      expect(await delivery()).toMatchObject({ providerReceipt: receipt, providerOutcome: 'delivered', acknowledgedAt: null });
      await outcomes.recordEmailOutcome(receipt, 'opened');
      expect(await delivery()).toMatchObject({ providerOutcome: 'opened' });
      await outcomes.recordEmailOutcome(receipt, 'bounced');
      await outcomes.recordEmailOutcome(receipt, 'delivered');
      await outcomes.recordEmailOutcome(receipt, 'sent');
      expect(await delivery()).toMatchObject({ providerOutcome: 'bounced', acknowledgedAt: null });
      await outcomes.recordEmailOutcome(receipt, 'complained');
      expect(await delivery()).toMatchObject({ providerOutcome: 'complained' });
    } finally {
      await prisma.opsNotificationLog.delete({ where: { id: row.id } });
      await prisma.opsNotificationProviderOutcome.deleteMany({ where: { receipt } });
      await prisma.$disconnect();
    }
  });
  it('persists independent version-bound recipient acknowledgments in PostgreSQL', async () => {
    const prisma = new PrismaService();
    const outbox = new NotificationOutboxService(prisma, { deliver: vi.fn() });
    const row = await outbox.queue(undefined, 'PMCM Admin', 'Review the current instruction');
    try {
      await new NotificationRecipientDeliveryService(prisma).deliver(row.id, async () => ({ status: 'resolved', addresses: ['a@example.test', 'b@example.test'] }), async () => ({ status: 'accepted', receipt: randomUUID() }));
      const audit = { write: vi.fn(async () => undefined) };
      const inbox = new NotificationInboxService(prisma, {} as never, audit as never);
      const actor = { id: 'test-user-a', role: 'client', email: 'a@example.test', name: 'A' } as never;
      const [notice] = await inbox.mine(actor);
      const other = await prisma.opsNotificationDelivery.findFirstOrThrow({ where: { notificationId: row.id, recipient: 'b@example.test' } });
      await expect(inbox.acknowledge(other.id, notice.version, actor)).rejects.toThrow('not found');
      await expect(inbox.acknowledge(notice.id, '0'.repeat(64), actor)).rejects.toThrow('changed');
      const read = await inbox.markRead(notice.id, notice.version, actor);
      expect((await prisma.opsNotificationDelivery.findUniqueOrThrow({ where: { id: notice.id } })).acknowledgedAt).toBeNull();
      expect(await inbox.markRead(notice.id, notice.version, actor)).toEqual(read);
      await inbox.acknowledge(notice.id, notice.version, actor);
      await inbox.acknowledge(notice.id, notice.version, actor);
      expect((await prisma.opsNotificationDelivery.findUniqueOrThrow({ where: { id: notice.id } })).acknowledgedAt).toBeInstanceOf(Date);
      expect((await prisma.opsNotificationDelivery.findUniqueOrThrow({ where: { id: notice.id } })).readAt?.toISOString()).toBe(read.readAt);
      expect((await prisma.opsNotificationDelivery.findUniqueOrThrow({ where: { id: other.id } })).acknowledgedAt).toBeNull();
      expect(audit.write).toHaveBeenCalledTimes(1);
      const dueAt = new Date(Date.now() + 60_000).toISOString();
      await expect(inbox.requireAcknowledgment(other.id, { dueAt, reason: 'Critical instruction' }, actor)).rejects.toThrow('Only PMCM');
      await inbox.requireAcknowledgment(other.id, { dueAt, reason: 'Critical instruction' }, { id: 'admin', role: 'pmcm-admin', email: 'admin@example.test', name: 'PMCM' } as never);
      const escalation = new NotificationEscalationService(prisma, outbox, audit as never);
      const now = new Date(Date.now() + 61_000);
      const results = await Promise.all([escalation.escalateDue(now), escalation.escalateDue(now)]);
      expect(results.reduce((sum, result) => sum + result.escalated, 0)).toBe(1);
      expect(await prisma.opsNotificationLog.count({ where: { idempotencyKey: { startsWith: `notification-escalation:${other.id}:` } } })).toBe(1);
      expect((await prisma.opsNotificationDelivery.findUniqueOrThrow({ where: { id: other.id } })).escalatedAt).toBeInstanceOf(Date);
      expect(await escalation.escalateDue(now)).toEqual({ escalated: 0 });
    } finally {
      const deliveries = await prisma.opsNotificationDelivery.findMany({ where: { notificationId: row.id }, select: { id: true } });
      await prisma.opsNotificationLog.deleteMany({ where: { OR: deliveries.map((entry) => ({ idempotencyKey: { startsWith: `notification-escalation:${entry.id}:` } })) } });
      await prisma.opsNotificationLog.delete({ where: { id: row.id } });
      await prisma.$disconnect();
    }
  });
  it('persists recipient acceptance across retries in PostgreSQL', async () => {
    const prisma = new PrismaService();
    const key = `p1_recipients_${randomUUID()}`;
    const outbox = new NotificationOutboxService(prisma, { deliver: vi.fn() });
    const row = await outbox.queue(undefined, 'PMCM Admin', 'Test', 'email', { idempotencyKey: key });
    const delivery = new NotificationRecipientDeliveryService(prisma);
    const resolve = vi.fn(async () => ({ status: 'resolved' as const, addresses: ['a@example.test', 'b@example.test'] }));
    const send = vi.fn(async (address: string) => address === 'a@example.test' ? { status: 'accepted' as const, receipt: 'accepted-a' } : { status: 'retryable_failure' as const });
    try {
      await expect(delivery.deliver(row.id, resolve, send)).resolves.toMatchObject({ status: 'retryable_failure' });
      await expect(delivery.deliver(row.id, resolve, send)).resolves.toMatchObject({ status: 'retryable_failure' });
      expect(resolve).toHaveBeenCalledTimes(2);
      expect(send.mock.calls.filter(([address]) => address === 'a@example.test')).toHaveLength(1);
      expect(await prisma.opsNotificationDelivery.findMany({ where: { notificationId: row.id }, orderBy: { recipient: 'asc' } })).toMatchObject([
        { recipient: 'a@example.test', status: 'accepted', attempts: 1 },
        { recipient: 'b@example.test', status: 'pending', attempts: 2 },
      ]);
    } finally {
      await prisma.opsNotificationLog.delete({ where: { id: row.id } });
      await prisma.$disconnect();
    }
  });
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
