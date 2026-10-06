import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { PareConfigurationError } from './pare-execution.policy';
import { PareSourceNotFoundError } from './pare-source.errors';
import { PareAiGatewayError } from './pare-ai-gateway';
import type { OpsPareDispatch, Prisma } from '@prisma/client';
import type { PrismaService } from '@prism/kernel/database';
import type { PAREApprovalRecord } from './pare.types';

const LEASE_MS = 5 * 60_000;
export const PARE_EXECUTION_TIMEOUT_MS = 4 * 60_000;
const MAX_BATCH = 100;
const MAX_BACKOFF_MS = 60 * 60_000;
const logger = new Logger('PareDispatchWorker');

async function executeWithTimeout(
  executor: PareDispatchExecutor,
  requestId: string,
  sourceDispatchId: string,
  executionRegistry?: PareDispatchExecutionRegistry,
): Promise<PAREApprovalRecord> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    return await new Promise<PAREApprovalRecord>((resolve, reject) => {
      const execution = Promise.resolve().then(() => executor.handleEmergencyTrigger(requestId, sourceDispatchId, controller.signal));
      executionRegistry?.add(execution);
      timer = setTimeout(() => {
        const error = new Error('PARE execution timed out; retry scheduled');
        error.name = 'PareExecutionTimeoutError';
        controller.abort(error);
        reject(error);
      }, PARE_EXECUTION_TIMEOUT_MS);
      void execution.then(resolve, reject);
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type PareDispatchExecutor = {
  handleEmergencyTrigger(requestId: string, sourceDispatchId: string, signal?: AbortSignal): Promise<PAREApprovalRecord>;
  recordDispatchActivity?(dispatch: { id: string; eventId: string; requestId: string }, approval: PAREApprovalRecord): Promise<void>;
};

export type PareDispatchExecutionRegistry = {
  add(execution: Promise<unknown>): void;
};

function available(now: Date, maxAttempts?: number): Prisma.OpsPareDispatchWhereInput {
  return {
    status: 'queued',
    ...(maxAttempts === undefined ? {} : { attempts: { lt: maxAttempts } }),
    nextAttemptAt: { lte: now },
    OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
  };
}

function terminalFailure(error: unknown): 'configuration' | 'missing' | 'gateway' | null {
  if (error instanceof PareConfigurationError || (error instanceof Error && error.name === 'PareConfigurationError')) return 'configuration';
  if (error instanceof PareSourceNotFoundError || (error instanceof Error && error.name === 'PareSourceNotFoundError')) return 'missing';
  if (error instanceof PareAiGatewayError && !error.retryable) return 'gateway';
  return null;
}

function failureReason(error: unknown, terminal: 'configuration' | 'missing' | 'gateway' | null, exhausted: boolean) {
  if (terminal === 'configuration') return 'PARE execution is disabled or misconfigured; operator action required';
  if (terminal === 'missing') return 'PARE source request or event was not found; operator action required';
  if (terminal === 'gateway') return 'PARE AI gateway returned a terminal failure; operator review required';
  return exhausted ? 'PARE execution failed; operator review required' : 'PARE execution failed; retry scheduled';
}

function settlement(
  row: OpsPareDispatch,
  outcome: { approvalRecordId?: string; error?: unknown },
  maxAttempts: number,
  now: Date,
): Prisma.OpsPareDispatchUncheckedUpdateManyInput {
  const release = { leaseToken: null, leaseExpiresAt: null };
  if (outcome.approvalRecordId) {
    return { ...release, status: 'succeeded', approvalRecordId: outcome.approvalRecordId, completedAt: now, failedAt: null, failureReason: null };
  }
  const attempts = row.attempts;
  const terminal = terminalFailure(outcome.error) !== null || attempts >= maxAttempts;
  return {
    ...release,
    attempts,
    status: terminal ? 'failed' : 'queued',
    failureReason: failureReason(outcome.error, terminalFailure(outcome.error), terminal),
    failedAt: terminal ? now : null,
    nextAttemptAt: terminal ? now : new Date(now.getTime() + Math.min(MAX_BACKOFF_MS, 60_000 * 2 ** Math.min(attempts - 1, 6))),
  };
}

export async function processPareDispatchQueue(
  prisma: PrismaService,
  executor: PareDispatchExecutor,
  requestedMaxAttempts?: number,
  requestedMaxBatch?: number,
  executionRegistry?: PareDispatchExecutionRegistry,
) {
  const maxAttempts = Number.isFinite(requestedMaxAttempts) ? Math.min(10, Math.max(1, Math.floor(requestedMaxAttempts!))) : 3;
  const maxBatch = Number.isFinite(requestedMaxBatch) ? Math.min(MAX_BATCH, Math.max(1, Math.floor(requestedMaxBatch!))) : MAX_BATCH;
  const rows = await prisma.opsPareDispatch.findMany({
    where: available(new Date(), maxAttempts),
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: maxBatch is clamped to MAX_BATCH (100) above.
    take: maxBatch,
  });
  const exhausted = await prisma.opsPareDispatch.findMany({
    where: { ...available(new Date()), attempts: { gte: maxAttempts } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: maxBatch is clamped to MAX_BATCH (100) above.
    take: maxBatch,
  });
  for (const row of exhausted) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: findMany caps each worker invocation to maxBatch.
    await prisma.opsPareDispatch.updateMany({
      where: { id: row.id, status: 'queued', attempts: { gte: maxAttempts }, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: new Date() } }] },
      data: { status: 'failed', leaseToken: null, leaseExpiresAt: null, failedAt: new Date(), failureReason: 'PARE execution failed; operator review required' },
    });
  }
  const processed: OpsPareDispatch[] = [];
  for (const row of rows) { // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: findMany caps each sweep.
    const leaseToken = randomUUID();
    const claimedAttempts = row.attempts + 1;
    const claimed = await prisma.opsPareDispatch.updateMany({
      where: { id: row.id, ...available(new Date(), maxAttempts) },
      data: { attempts: { increment: 1 }, leaseToken, leaseExpiresAt: new Date(Date.now() + LEASE_MS) },
    });
    if (claimed.count !== 1) continue;

    let outcome: { approvalRecordId?: string; error?: unknown };
    try {
      const approval = await executeWithTimeout(executor, row.requestId, row.id, executionRegistry);
      await executor.recordDispatchActivity?.({ id: row.id, eventId: row.eventId, requestId: row.requestId }, approval);
      outcome = { approvalRecordId: approval.id };
    } catch (error) {
      outcome = { error };
    }
    const updated = await prisma.opsPareDispatch.updateMany({
      where: { id: row.id, status: 'queued', leaseToken },
      data: settlement({ ...row, attempts: claimedAttempts }, outcome, maxAttempts, new Date()),
    });
    if (updated.count !== 1) {
      if (outcome.approvalRecordId) logger.warn(`PARE approval ${outcome.approvalRecordId} was created, but dispatch ${row.id} settlement was superseded`);
      continue;
    }
    const saved = await prisma.opsPareDispatch.findUnique({ where: { id: row.id } });
    if (saved) processed.push(saved);
  }
  return processed;
}
