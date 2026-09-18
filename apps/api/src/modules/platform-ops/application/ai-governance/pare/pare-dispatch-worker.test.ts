import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpsPareDispatch, Prisma } from '@prisma/client';
import type { PrismaService } from '@prism/kernel/database';
import type { PAREApprovalRecord } from './pare.types';
import { PareConfigurationError } from './pare-execution.policy';
import { PareSourceNotFoundError } from './pare-source.errors';
import { PARE_EXECUTION_TIMEOUT_MS, processPareDispatchQueue } from './pare-dispatch-worker';
import { PareDispatchOutboxService } from './pare-dispatch-outbox.service';
import { PAREService } from './pare.service';

type LeaseClause = { leaseExpiresAt: null | { lte: Date } };
type DispatchWhere = {
  id?: string;
  status?: string;
  leaseToken?: string;
  attempts?: { lt?: number; gte?: number };
  nextAttemptAt?: { lte?: Date };
  OR?: LeaseClause[];
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dispatch_1', eventId: 'event_1', requestId: 'request_1', sourceUpdatedAt: new Date('2026-09-08T00:00:00Z'),
    status: 'queued', attempts: 0, correlationId: 'withdraw:request_1', leaseToken: null, leaseExpiresAt: null,
    nextAttemptAt: new Date(Date.now() - 1_000), failureReason: null, approvalRecordId: null, completedAt: null, failedAt: null,
    createdAt: new Date('2026-09-08T00:00:00Z'), updatedAt: new Date('2026-09-08T00:00:00Z'), ...overrides,
  } as OpsPareDispatch;
}

function harness(initial: OpsPareDispatch[]) {
  const rows = initial;
  const matches = (value: OpsPareDispatch, where: DispatchWhere): boolean => {
    if (where.id && value.id !== where.id) return false;
    if (where.status && value.status !== where.status) return false;
    if (where.leaseToken && value.leaseToken !== where.leaseToken) return false;
    if (where.attempts?.lt !== undefined && !(value.attempts < where.attempts.lt)) return false;
    if (where.attempts?.gte !== undefined && !(value.attempts >= where.attempts.gte)) return false;
    if (where.nextAttemptAt?.lte && value.nextAttemptAt > where.nextAttemptAt.lte) return false;
    if (where.OR && !where.OR.some((clause) => (clause.leaseExpiresAt === null ? value.leaseExpiresAt === null : value.leaseExpiresAt && value.leaseExpiresAt <= clause.leaseExpiresAt.lte))) return false;
    return true;
  };
  const apply = (value: OpsPareDispatch, data: Record<string, unknown>) => {
    const target = value as unknown as Record<string, unknown>;
    Object.entries(data).forEach(([key, item]) => {
      if (item && typeof item === 'object' && 'increment' in item) {
        const increment = item.increment;
        target[key] = (typeof target[key] === 'number' && typeof increment === 'number')
          ? target[key] + increment
          : target[key];
      } else {
        target[key] = item;
      }
    });
  };
  const prisma = {
    opsPareDispatch: {
      findMany: vi.fn(async ({ where, take }: { where: DispatchWhere; take: number }) => rows.filter((value) => matches(value, where)).slice(0, take)),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rows.find((value) => value.id === where.id) ?? null),
      updateMany: vi.fn(async ({ where, data }: { where: DispatchWhere; data: Record<string, unknown> }) => {
        const value = rows.find((candidate) => matches(candidate, where));
        if (!value) return { count: 0 };
        apply(value, data);
        return { count: 1 };
      }),
    },
  } as unknown as PrismaService;
  return { prisma, rows };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PARE dispatch outbox', () => {
  it('claims and settles a successful dispatch with the approval record id', async () => {
    const { prisma, rows } = harness([row()]);
    const recordDispatchActivity = vi.fn(async () => undefined);
    await processPareDispatchQueue(prisma, {
      handleEmergencyTrigger: vi.fn(async () => ({ id: 'approval_1' } as unknown as PAREApprovalRecord)),
      recordDispatchActivity,
    });
    expect(rows[0]).toMatchObject({ status: 'succeeded', attempts: 1, approvalRecordId: 'approval_1', leaseToken: null });
    expect(recordDispatchActivity).toHaveBeenCalledWith(
      { id: 'dispatch_1', eventId: 'event_1', requestId: 'request_1' },
      { id: 'approval_1' },
    );
  });

  it('retries unknown failures and terminally fails at the max attempt', async () => {
    const { prisma, rows } = harness([row()]);
    const execute = vi.fn(async () => { throw new Error('temporary provider failure'); });
    await processPareDispatchQueue(prisma, { handleEmergencyTrigger: execute }, 2);
    expect(rows[0]).toMatchObject({ status: 'queued', attempts: 1 });
    rows[0].nextAttemptAt = new Date(Date.now() - 1_000);
    await processPareDispatchQueue(prisma, { handleEmergencyTrigger: execute }, 2);
    expect(rows[0]).toMatchObject({ status: 'failed', attempts: 2, failureReason: 'PARE execution failed; operator review required' });
  });

  it('terminally records configuration and missing-source failures', async () => {
    const config = harness([row({ id: 'config' })]);
    await processPareDispatchQueue(config.prisma, { handleEmergencyTrigger: vi.fn(async () => { throw new PareConfigurationError('PARE disabled'); }) });
    expect(config.rows[0]).toMatchObject({ status: 'failed', failureReason: expect.stringContaining('disabled or misconfigured') });
    const missing = harness([row({ id: 'missing' })]);
    await processPareDispatchQueue(missing.prisma, { handleEmergencyTrigger: vi.fn(async () => { throw new PareSourceNotFoundError('source missing'); }) });
    expect(missing.rows[0]).toMatchObject({ status: 'failed', failureReason: expect.stringContaining('source request or event') });
  });

  it('settles an expired lease at the retry budget without executing again', async () => {
    const { prisma, rows } = harness([row({ attempts: 2, leaseToken: 'crashed', leaseExpiresAt: new Date(Date.now() - 1_000) })]);
    const execute = vi.fn();
    await processPareDispatchQueue(prisma, { handleEmergencyTrigger: execute }, 2);
    expect(execute).not.toHaveBeenCalled();
    expect(rows[0]).toMatchObject({ status: 'failed', attempts: 2, leaseToken: null });
  });

  it('writes duplicate source transitions through the supplied transaction context to one row', async () => {
    const saved = new Map<string, OpsPareDispatch>();
    const tx = {
      opsPareDispatch: {
        upsert: vi.fn(async ({ where, create }: {
          where: { requestId_sourceUpdatedAt: { requestId: string; sourceUpdatedAt: Date } };
          create: OpsPareDispatch;
        }) => {
          const key = `${where.requestId_sourceUpdatedAt.requestId}:${where.requestId_sourceUpdatedAt.sourceUpdatedAt.toISOString()}`;
          if (!saved.has(key)) saved.set(key, create);
          return saved.get(key);
        }),
      },
    } as unknown as Prisma.TransactionClient;
    const service = new PareDispatchOutboxService({ opsPareDispatch: {} } as unknown as PrismaService, {} as unknown as PAREService);
    const input = { eventId: 'event_1', requestId: 'request_1', sourceUpdatedAt: new Date('2026-09-08T00:00:00Z'), correlationId: 'withdraw:request_1' };
    const first = await service.queue(input, { prisma: tx, correlationId: input.correlationId });
    const second = await service.queue(input, { prisma: tx, correlationId: input.correlationId });
    expect(first.id).toBe(second.id);
    expect(saved.size).toBe(1);
  });

  it('releases a timed-out execution for a later retry', async () => {
    const { prisma, rows } = harness([row()]);
    const execute = vi.fn((_requestId: string, _dispatchId: string, signal?: AbortSignal) => new Promise<never>((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const pending = processPareDispatchQueue(prisma, { handleEmergencyTrigger: execute }, 2);
    await vi.advanceTimersByTimeAsync(PARE_EXECUTION_TIMEOUT_MS + 1);
    await pending;
    expect(rows[0]).toMatchObject({ status: 'queued', attempts: 1, leaseToken: null });
    expect(execute).toHaveBeenCalledWith('request_1', 'dispatch_1', expect.any(AbortSignal));
  });
});
