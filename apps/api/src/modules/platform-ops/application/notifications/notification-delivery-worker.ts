import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { OpsNotificationLog, Prisma } from '@prisma/client';
import type { PrismaService } from '@prism/kernel/database';
import type { NotificationDeliveryPort, NotificationDeliveryResult } from '../../contracts/notifications/notification-delivery.port';

const LEASE_MS = 5 * 60_000;
const logger = new Logger('NotificationDeliveryWorker');

function available(now: Date): Prisma.OpsNotificationLogWhereInput {
  return { status: 'queued', nextAttemptAt: { lte: now }, OR: [
    { leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } },
  ] };
}

async function deliver(row: OpsNotificationLog, adapter: NotificationDeliveryPort): Promise<NotificationDeliveryResult> {
  try {
    const result = await withTimeout(adapter.deliver({ idempotencyKey: row.id, channel: row.channel, eventId: row.eventId, recipient: row.recipient, message: row.message }));
    if (result.status === 'accepted' && !result.receipt.trim()) return { status: 'retryable_failure' };
    return result;
  } catch {
    // Provider responses may contain credentials or recipient data; retain a safe reason.
    return { status: 'retryable_failure' };
  }
}

async function withTimeout(delivery: Promise<NotificationDeliveryResult>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([delivery, new Promise<NotificationDeliveryResult>((resolve) => {
      timer = setTimeout(() => resolve({ status: 'retryable_failure' }), 30_000);
      timer.unref();
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

function settlement(row: OpsNotificationLog, result: NotificationDeliveryResult, maxAttempts: number, now: Date): Prisma.OpsNotificationLogUpdateManyMutationInput {
  const release = { leaseToken: null, leaseExpiresAt: null };
  const attempts = row.attempts + 1;
  if (result.status === 'accepted') return { ...release, attempts, status: 'sent', sentAt: now, providerReceipt: result.receipt, failureReason: null, failedAt: null };
  const terminal = result.status === 'permanent_failure' || attempts >= maxAttempts;
  return { ...release, attempts, status: terminal ? 'failed' : 'queued', failedAt: now,
    failureReason: result.reason ?? (terminal ? 'Delivery failed; operator review required' : 'Delivery failed; retry scheduled'),
    nextAttemptAt: new Date(now.getTime() + Math.min(60 * 60_000, 60_000 * 2 ** Math.min(attempts - 1, 6))),
  };
}

export async function processNotificationQueue(prisma: PrismaService, adapter: NotificationDeliveryPort, requestedMaxAttempts?: number) {
  const maxAttempts = Number.isFinite(requestedMaxAttempts) ? Math.min(10, Math.max(1, Math.floor(requestedMaxAttempts!))) : 3;
  const now = new Date();
  const rows = await prisma.opsNotificationLog.findMany({ where: available(now), orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 100 });
  const processed: OpsNotificationLog[] = [];
  for (const row of rows) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: findMany above limits each worker invocation to 100 notifications.
    const leaseToken = randomUUID();
    const claimed = await prisma.opsNotificationLog.updateMany({ where: { id: row.id, ...available(new Date()) }, data: { leaseToken, leaseExpiresAt: new Date(Date.now() + LEASE_MS) } });
    if (claimed.count !== 1) continue;
    const result = await deliver(row, adapter);
    const updated = await prisma.opsNotificationLog.updateMany({ where: { id: row.id, status: 'queued', leaseToken }, data: settlement(row, result, maxAttempts, new Date()) });
    if (updated.count !== 1) {
      if (result.status === 'accepted') logger.warn(`Provider accepted notification ${row.id}, but its settlement was superseded`);
      continue;
    }
    const saved = await prisma.opsNotificationLog.findUnique({ where: { id: row.id } });
    if (saved) processed.push(saved);
  }
  return processed;
}
