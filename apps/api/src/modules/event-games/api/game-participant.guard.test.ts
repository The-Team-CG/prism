import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { GameParticipantGuard } from './game-participant.guard';

const credential = 'G'.repeat(43);
const sessionId = 'session-1';

function setup(input: { credential?: string | string[]; sessionId?: string; authorized?: boolean } = {}) {
  const transaction = { prisma: {}, correlationId: 'participant-guard', actorId: 'anonymous-game-participant' } as PrismTransactionContext;
  const transactions = { run: vi.fn(async (work: (tx: PrismTransactionContext) => Promise<unknown>) => work(transaction)) };
  const pinStore = { isParticipantAuthorized: vi.fn().mockResolvedValue(input.authorized ?? true) };
  const request = {
    params: { sessionId: input.sessionId ?? sessionId },
    headers: input.credential === undefined ? {} : { 'x-prism-game-credential': input.credential },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard: new GameParticipantGuard(pinStore as never, transactions as never), pinStore, transactions, transaction, context };
}

describe('GameParticipantGuard', () => {
  it('requires a valid event credential with an active grant for the exact session', async () => {
    const { guard, pinStore, transaction, context } = setup({ credential });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(pinStore.isParticipantAuthorized).toHaveBeenCalledWith({
      sessionId,
      tokenDigest: createHash('sha256').update(credential).digest('hex'),
    }, transaction);
  });

  it.each([undefined, 'too-short', ['G'.repeat(43)]])(
    'rejects missing or malformed credential without querying storage (%s)', async (value) => {
      const { guard, pinStore, context } = setup({ credential: value as string | string[] | undefined });

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(pinStore.isParticipantAuthorized).not.toHaveBeenCalled();
    },
  );

  it('rejects revoked, cross-event, or wrong-session grants with one generic response', async () => {
    const { guard, context } = setup({ credential, sessionId: 'other-session', authorized: false });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      message: 'Game participant access is not authorized',
    });
  });
});
