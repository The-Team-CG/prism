import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { OpsNotificationLog, Prisma } from '@prisma/client';
import type { PrismaService } from '@prism/kernel/database';
import type { GuestPassDeliveryEligibilityReader } from '@prism/contexts/read-models/guest-pass-delivery-eligibility';
import type { NotificationDeliveryPort, NotificationDeliveryResult } from '../../contracts/notifications/notification-delivery.port';
import {
  decryptGuestPassPayload,
  parseGuestPassEncryptionKey,
} from '../../infrastructure/notifications/notification-sensitive-payload.crypto';

const LEASE_MS = 5 * 60_000;
const UNCONFIGURED_DELAY_MS = 60 * 60_000;
const logger = new Logger('NotificationDeliveryWorker');

export interface NotificationQueueOptions {
  maxAttempts?: number;
  encryptionKey?: unknown;
  guestPassDeliveryEligibilityReader?: GuestPassDeliveryEligibilityReader;
}

function available(now: Date): Prisma.OpsNotificationLogWhereInput {
  return { status: 'queued', nextAttemptAt: { lte: now }, OR: [
    { leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } },
  ] };
}

async function deliver(
  row: OpsNotificationLog,
  adapter: NotificationDeliveryPort | undefined,
  message: string,
): Promise<NotificationDeliveryResult> {
  if (!adapter) return { status: 'unconfigured' };
  try {
    const result = await withTimeout(adapter.deliver({
      idempotencyKey: row.id,
      channel: row.channel,
      recipient: row.recipient,
      message,
    }));
    if (result.status === 'accepted' && !result.receipt.trim()) return { status: 'retryable_failure' };
    if (result.status === 'captured' && !result.receipt.trim()) return { status: 'retryable_failure' };
    return result;
  } catch {
    // Adapter errors can contain message bodies, credentials, or recipient data.
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

function settlement(
  row: OpsNotificationLog,
  result: NotificationDeliveryResult,
  maxAttempts: number,
  now: Date,
): Prisma.OpsNotificationLogUpdateManyMutationInput {
  const release = { leaseToken: null, leaseExpiresAt: null };
  if (result.status === 'unconfigured') {
    return {
      ...release,
      failureReason: 'Delivery provider is not configured',
      nextAttemptAt: new Date(now.getTime() + UNCONFIGURED_DELAY_MS),
    };
  }
  const attempts = row.attempts + 1;
  if (result.status === 'accepted') {
    return {
      ...release,
      attempts,
      status: 'sent',
      sentAt: now,
      providerReceipt: result.receipt,
      failureReason: null,
      failedAt: null,
      sensitivePayload: null,
    };
  }
  if (result.status === 'captured') {
    return {
      ...release,
      attempts,
      status: 'captured',
      sentAt: null,
      providerReceipt: row.guestPassId ? 'guest-pass-captured' : result.receipt,
      failureReason: null,
      failedAt: null,
      sensitivePayload: null,
    };
  }
  const terminal = result.status === 'permanent_failure' || attempts >= maxAttempts;
  return {
    ...release,
    attempts,
    status: terminal ? 'failed' : 'queued',
    failedAt: now,
    failureReason: terminal ? 'Delivery failed; operator review required' : 'Delivery failed; retry scheduled',
    nextAttemptAt: new Date(now.getTime() + Math.min(60 * 60_000, 60_000 * 2 ** Math.min(attempts - 1, 6))),
    ...(row.guestPassId && terminal ? { sensitivePayload: null } : {}),
  };
}

function holdsLease(row: OpsNotificationLog, leaseToken: string, now = new Date()) {
  return row.status === 'queued'
    && row.leaseToken === leaseToken
    && row.leaseExpiresAt !== null
    && row.leaseExpiresAt.getTime() > now.getTime();
}

async function readSaved(prisma: PrismaService, id: string) {
  return prisma.opsNotificationLog.findUnique({ where: { id } });
}

function appendProcessed(processed: OpsNotificationLog[], saved: OpsNotificationLog) {
  processed.push(saved.guestPassId
    ? { ...saved, guestPassId: null, sensitivePayload: null }
    : saved);
}

async function cancelClaimedGuestPass(
  prisma: PrismaService,
  row: OpsNotificationLog,
  leaseToken: string,
  processed: OpsNotificationLog[],
) {
  const updated = await prisma.opsNotificationLog.updateMany({
    where: { id: row.id, guestPassId: { not: null }, status: 'queued', leaseToken },
    data: {
      status: 'cancelled',
      sensitivePayload: null,
      leaseToken: null,
      leaseExpiresAt: null,
      failureReason: 'Guest pass delivery canceled',
      failedAt: null,
    },
  });
  if (updated.count !== 1) return;
  const saved = await readSaved(prisma, row.id);
  if (saved) appendProcessed(processed, saved);
}

async function failAndRedactGuestPass(
  prisma: PrismaService,
  row: OpsNotificationLog,
  leaseToken: string,
  processed: OpsNotificationLog[],
) {
  const updated = await prisma.opsNotificationLog.updateMany({
    where: { id: row.id, guestPassId: { not: null }, status: 'queued', leaseToken },
    data: {
      status: 'failed',
      attempts: row.attempts + 1,
      sensitivePayload: null,
      leaseToken: null,
      leaseExpiresAt: null,
      failureReason: 'Guest pass delivery payload unavailable',
      failedAt: new Date(),
    },
  });
  if (updated.count !== 1) return;
  const saved = await readSaved(prisma, row.id);
  if (saved) appendProcessed(processed, saved);
}

async function retryUnavailableGuestPass(
  prisma: PrismaService,
  row: OpsNotificationLog,
  leaseToken: string,
  processed: OpsNotificationLog[],
) {
  const updated = await prisma.opsNotificationLog.updateMany({
    where: { id: row.id, guestPassId: { not: null }, status: 'queued', leaseToken },
    data: {
      leaseToken: null,
      leaseExpiresAt: null,
      failureReason: 'Guest pass delivery key is not configured',
      nextAttemptAt: new Date(Date.now() + UNCONFIGURED_DELAY_MS),
    },
  });
  if (updated.count !== 1) return;
  const saved = await readSaved(prisma, row.id);
  if (saved) appendProcessed(processed, saved);
}

async function saveDeliveryResult(
  prisma: PrismaService,
  row: OpsNotificationLog,
  leaseToken: string,
  result: NotificationDeliveryResult,
  maxAttempts: number,
  processed: OpsNotificationLog[],
) {
  const updated = await prisma.opsNotificationLog.updateMany({
    where: { id: row.id, status: 'queued', leaseToken },
    data: settlement(row, result, maxAttempts, new Date()),
  });
  if (updated.count !== 1) {
    if (result.status === 'accepted') logger.warn(`Provider accepted notification ${row.id}, but its settlement was superseded`);
    return;
  }
  const saved = await readSaved(prisma, row.id);
  if (saved) appendProcessed(processed, saved);
}

export async function processNotificationQueue(
  prisma: PrismaService,
  adapter: NotificationDeliveryPort | undefined,
  options: NotificationQueueOptions = {},
) {
  const maxAttempts = Number.isFinite(options.maxAttempts)
    ? Math.min(10, Math.max(1, Math.floor(options.maxAttempts!)))
    : 3;
  const encryptionKey = parseGuestPassEncryptionKey(options.encryptionKey);
  const now = new Date();
  const rows = await prisma.opsNotificationLog.findMany({
    where: {
      ...available(now),
      ...(adapter?.deliveryMode === 'capture' ? { guestPassId: { not: null } } : {}),
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 100,
  });
  const processed: OpsNotificationLog[] = [];

  for (const row of rows) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: findMany above limits each worker invocation to 100 notifications.
    const leaseToken = randomUUID();
    const claimed = await prisma.opsNotificationLog.updateMany({
      where: { id: row.id, ...available(new Date()) },
      data: { leaseToken, leaseExpiresAt: new Date(Date.now() + LEASE_MS) },
    });
    if (claimed.count !== 1) continue;

    if (!row.guestPassId) {
      const result = await deliver(row, adapter, row.message);
      await saveDeliveryResult(prisma, row, leaseToken, result, maxAttempts, processed);
      continue;
    }

    const claimedRow = await readSaved(prisma, row.id);
    if (!claimedRow || !holdsLease(claimedRow, leaseToken)) continue;
    const passId = claimedRow.guestPassId;
    const eventId = claimedRow.eventId;
    if (!passId || !eventId || adapter?.deliveryMode !== 'capture' || !options.guestPassDeliveryEligibilityReader) {
      await cancelClaimedGuestPass(prisma, claimedRow, leaseToken, processed);
      continue;
    }

    let eligible = false;
    try {
      eligible = await options.guestPassDeliveryEligibilityReader.canDeliverGuestPass(passId, eventId);
    } catch {
      // Fail closed when the pass/event owner cannot confirm current eligibility.
    }

    const currentRow = await readSaved(prisma, row.id);
    if (!currentRow || !holdsLease(currentRow, leaseToken)) continue;
    if (!eligible || currentRow.guestPassId !== passId || currentRow.eventId !== eventId) {
      await cancelClaimedGuestPass(prisma, currentRow, leaseToken, processed);
      continue;
    }

    if (!encryptionKey) {
      await retryUnavailableGuestPass(prisma, currentRow, leaseToken, processed);
      continue;
    }

    let plaintextMessage: string;
    try {
      if (!currentRow.sensitivePayload) throw new Error('Missing encrypted payload');
      plaintextMessage = decryptGuestPassPayload(currentRow.sensitivePayload, encryptionKey);
    } catch {
      await failAndRedactGuestPass(prisma, currentRow, leaseToken, processed);
      continue;
    }

    let result = await deliver(currentRow, adapter, plaintextMessage);
    // Guest-pass links are capture-only while PA-66 remains open, never provider-accepted sends.
    if (result.status === 'accepted') result = { status: 'permanent_failure' };
    await saveDeliveryResult(prisma, currentRow, leaseToken, result, maxAttempts, processed);
  }

  return processed;
}
