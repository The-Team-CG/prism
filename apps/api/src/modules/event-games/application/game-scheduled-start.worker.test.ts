import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { GameScheduledStartWorker } from './game-scheduled-start.worker';

const eventId = 'event-1';
const sessionId = '00000000-0000-4000-8000-000000000002';
const gameId = '00000000-0000-4000-8000-000000000004';
const receiptId = '00000000-0000-4000-8000-000000000003';
const candidate = { event_id: eventId, session_id: sessionId, game_definition_id: gameId, request_receipt_id: receiptId };

function createWorker(claimResults: Array<typeof candidate[]>, definitionRows: Array<{ id: string }> = [{ id: gameId }]) {
  const prisma = { $queryRaw: vi.fn(async () => [candidate]) };
  const transactionQueryRaw = vi.fn(async (strings: TemplateStringsArray) => {
    if (strings.join('').includes('FOR SHARE OF d')) return definitionRows;
    return claimResults.shift() ?? [];
  });
  const transaction = {
    prisma: { $queryRaw: transactionQueryRaw },
    correlationId: 'scheduled-start-test',
    actorId: 'system:event-games-scheduler',
  } as unknown as PrismTransactionContext;
  const transactions = {
    run: vi.fn(async (work: (context: PrismTransactionContext) => Promise<unknown>) => work(transaction)),
  };
  const audit = { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
  const pinStore = { releaseExpiredReservations: vi.fn().mockResolvedValue(0) };
  const eventAccess = { isEventOpen: vi.fn().mockResolvedValue(true) };
  const worker = new GameScheduledStartWorker(prisma as never, transactions as never, audit as never, pinStore as never, eventAccess as never);

  return { worker, prisma, transaction, transactions, audit, pinStore, eventAccess, transactionQueryRaw };
}

describe('GameScheduledStartWorker', () => {
  it('starts a due session transactionally and audits the single transition', async () => {
    const { worker, prisma, transaction, transactions, audit, pinStore } = createWorker([[candidate]]);
    const now = new Date('2026-10-20T10:00:00.000Z');

    const started = await worker.runDueStarts(now);

    expect(started).toBe(1);
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    expect(transactions.run).toHaveBeenCalledTimes(2);
    expect(pinStore.releaseExpiredReservations).toHaveBeenCalledWith({ now }, transaction);
    expect(transactions.run).toHaveBeenNthCalledWith(1, expect.any(Function), { actorId: 'system:expiry' });
    expect(audit.recordHostWrite).toHaveBeenCalledWith({
      eventId,
      actorId: 'system:event-games-scheduler',
      actorRole: 'system',
      action: 'start_session',
      resourceType: 'session',
      resourceId: sessionId,
      outcome: 'started',
      resultId: sessionId,
      requestReceiptId: receiptId,
      transition: {
        beforeStatus: 'scheduled',
        afterStatus: 'live',
        beforeVersion: null,
        afterVersion: null,
      },
      timestamp: now,
    }, transaction);
  });

  it('ignores repeated delivery after the due session was already claimed', async () => {
    const { worker, audit } = createWorker([[candidate], []]);
    const now = new Date('2026-10-20T10:00:00.000Z');

    expect(await worker.runDueStarts(now)).toBe(1);
    expect(await worker.runDueStarts(now)).toBe(0);
    expect(audit.recordHostWrite).toHaveBeenCalledOnce();
  });

  it('does not start or audit a due session after event closure', async () => {
    const { worker, transaction, eventAccess, audit } = createWorker([[candidate]]);
    eventAccess.isEventOpen.mockResolvedValue(false);

    expect(await worker.runDueStarts(new Date('2026-10-20T10:00:00.000Z'))).toBe(0);
    expect(transaction.prisma.$queryRaw).not.toHaveBeenCalled();
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });

  it('does not start a scheduled session after its game was archived', async () => {
    const { worker, transactionQueryRaw, audit } = createWorker([[candidate]], []);

    expect(await worker.runDueStarts(new Date('2026-10-20T10:00:00.000Z'))).toBe(0);
    expect(transactionQueryRaw).toHaveBeenCalledOnce();
    expect(transactionQueryRaw.mock.calls[0]?.[0].join('')).toContain('FOR SHARE OF d');
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });
});
