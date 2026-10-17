import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { GameParticipantGrantPersistenceError } from '../contracts/game-pin-store.port';
import { EventGamesPinPrismaStoreAdapter } from './event-games-pin-prisma-store.adapter';

function transactionWithQueryRows(...responses: unknown[][]) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const executeCalls: Array<{ sql: string; values: unknown[] }> = [];
  const prisma = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ sql: Array.from(strings).join('?'), values });
      return responses.shift() ?? [];
    }),
    $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      executeCalls.push({ sql: Array.from(strings).join('?'), values });
      return 1;
    }),
  };
  return { transaction: { prisma } as unknown as PrismTransactionContext, calls, executeCalls };
}

describe('EventGamesPinPrismaStoreAdapter', () => {
  it('expires and releases stale PIN reservations while recording their history in the same transaction', async () => {
    const now = new Date('2026-10-16T12:00:00.000Z');
    const { transaction, calls } = transactionWithQueryRows([{ released_count: 2n }]);
    const store = new EventGamesPinPrismaStoreAdapter();

    await expect(store.releaseExpiredReservations({ now }, transaction)).resolves.toBe(2);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain('DELETE FROM "event_games"."active_pin_reservations"');
    expect(calls[0]?.sql).toContain('"expires_at" <= ?');
    expect(calls[0]?.sql).toContain('INSERT INTO "event_games"."pin_history"');
    expect(calls[0]?.sql).toContain("'expired'");
    expect(calls[0]?.sql).toContain("'system:expiry'");
    expect(calls[0]?.values).toContain(now);
  });

  it('requires an unexpired active PIN reservation, locks the session, and honors its snapshot after publication', async () => {
    const now = new Date('2026-10-16T12:00:00.000Z');
    const { transaction, calls } = transactionWithQueryRows([]);
    const store = new EventGamesPinPrismaStoreAdapter();

    await expect(store.findJoinableSessionByPinDigest({ pinDigest: 'digest-only', now }, transaction)).resolves.toBeNull();

    expect(calls[0]?.sql).toContain('FROM "event_games"."active_pin_reservations" r');
    expect(calls[0]?.sql).toContain('r."expires_at" > ?');
    expect(calls[0]?.sql).toContain('d."status" = \'published\'');
    expect(calls[0]?.sql).toContain('d."archived_at" IS NULL');
    expect(calls[0]?.sql).toContain('s."entry_mode" = \'active\'');
    expect(calls[0]?.sql).toContain('FOR UPDATE OF r, s');
    expect(calls[0]?.values).toContain('digest-only');
    expect(calls[0]?.values).toContain(now);
  });

  it('authorizes a participant only through an active credential and grant joined to the exact session event', async () => {
    const { transaction, calls } = transactionWithQueryRows([{ authorized: true }]);
    const store = new EventGamesPinPrismaStoreAdapter();

    await expect(store.isParticipantAuthorized({ sessionId: 'session-1', tokenDigest: 'token-digest' }, transaction))
      .resolves.toBe(true);

    expect(calls[0]?.sql).toContain('FROM "event_games"."participant_credentials" c');
    expect(calls[0]?.sql).toContain('JOIN "event_games"."session_participation_grants" g');
    expect(calls[0]?.sql).toContain('g."event_id" = c."event_id"');
    expect(calls[0]?.sql).toContain('JOIN "event_games"."game_sessions" s');
    expect(calls[0]?.sql).toContain('s."event_id" = g."event_id"');
    expect(calls[0]?.sql).toContain('s."id" = g."session_id"');
    expect(calls[0]?.sql).toContain('c."revoked_at" IS NULL');
    expect(calls[0]?.sql).toContain('g."revoked_at" IS NULL');
    expect(calls[0]?.values).toEqual(['session-1', 'token-digest']);
  });

  it('denies missing active grants', async () => {
    const { transaction } = transactionWithQueryRows([{ authorized: false }]);
    const store = new EventGamesPinPrismaStoreAdapter();

    await expect(store.isParticipantAuthorized({ sessionId: 'session-1', tokenDigest: 'token-digest' }, transaction))
      .resolves.toBe(false);
  });

  it('returns only the minimum public session state and persists digests, not PINs or credentials', async () => {
    const { transaction, calls, executeCalls } = transactionWithQueryRows(
      [{ id: 'credential-1', revoked_at: null }],
      [{
        event_id: 'event-1', session_id: 'session-1', credential_id: 'credential-1',
        token_digest: 'token-digest', title: 'Live Trivia', game_kind: 'live-trivia', status: 'lobby',
        grant_revoked_at: null, credential_revoked_at: null,
      }],
    );
    const store = new EventGamesPinPrismaStoreAdapter();

    const result = await store.createParticipantGrant({
      eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', credentialId: 'credential-1',
      tokenDigest: 'token-digest', idempotencyKeyDigest: 'idempotency-digest', createCredential: true,
      now: new Date('2026-10-16T12:00:00.000Z'),
    }, transaction);

    expect(result).toEqual({ sessionId: 'session-1', title: 'Live Trivia', kind: 'live-trivia', status: 'lobby' });
    expect(executeCalls[0]?.sql).toContain('ON CONFLICT ("token_digest") DO NOTHING');
    expect(executeCalls[1]?.sql).toContain('ON CONFLICT DO NOTHING');
    expect(executeCalls.flatMap(({ values }) => values)).toContain('token-digest');
    expect(executeCalls.flatMap(({ values }) => values)).toContain('idempotency-digest');
    expect(JSON.stringify(executeCalls)).not.toContain('042681');
    expect(JSON.stringify(executeCalls)).not.toContain('A'.repeat(43));
    expect(calls[1]?.sql).toContain('g."join_idempotency_key_digest" = ?');
  });

  it('reuses the same event-scoped session grant when a retained credential retries with a new key', async () => {
    const { transaction, calls, executeCalls } = transactionWithQueryRows(
      [{ id: 'credential-1', revoked_at: null }],
      [{
        event_id: 'event-1', session_id: 'session-1', credential_id: 'credential-1',
        token_digest: 'token-digest', title: 'Live Trivia', game_kind: 'live-trivia', status: 'live',
        grant_revoked_at: null, credential_revoked_at: null,
      }],
    );
    const store = new EventGamesPinPrismaStoreAdapter();

    const result = await store.createParticipantGrant({
      eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', credentialId: 'credential-1',
      tokenDigest: 'token-digest', idempotencyKeyDigest: 'new-idempotency-digest', createCredential: false,
      now: new Date('2026-10-16T12:00:00.000Z'),
    }, transaction);

    expect(result).toEqual({ sessionId: 'session-1', title: 'Live Trivia', kind: 'live-trivia', status: 'live' });
    expect(executeCalls[0]?.sql).toContain('ON CONFLICT DO NOTHING');
    expect(calls[1]?.sql).toContain('g."join_idempotency_key_digest" = ?');
    expect(calls[1]?.sql).toContain('g."participant_credential_id" = ?');
    expect(calls[1]?.values).toContain('credential-1');
  });

  it('throws on a failed grant readback so a newly created credential rolls back with the transaction', async () => {
    const { transaction, executeCalls } = transactionWithQueryRows(
      [{ id: 'credential-1', revoked_at: null }],
      [],
    );
    const store = new EventGamesPinPrismaStoreAdapter();

    await expect(store.createParticipantGrant({
      eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', credentialId: 'credential-1',
      tokenDigest: 'token-digest', idempotencyKeyDigest: 'idempotency-digest', createCredential: true,
      now: new Date('2026-10-16T12:00:00.000Z'),
    }, transaction)).rejects.toBeInstanceOf(GameParticipantGrantPersistenceError);

    expect(executeCalls).toHaveLength(2);
    expect(executeCalls[0]?.sql).toContain('INSERT INTO "event_games"."participant_credentials"');
    expect(executeCalls[1]?.sql).toContain('INSERT INTO "event_games"."session_participation_grants"');
  });
});
