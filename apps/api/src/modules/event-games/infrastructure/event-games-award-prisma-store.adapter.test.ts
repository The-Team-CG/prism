import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { EventGamesAwardPrismaStoreAdapter } from './event-games-award-prisma-store.adapter';

function transactionWithQueryRows(...responses: unknown[][]) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const prisma = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ sql: Array.from(strings).join('?'), values });
      return responses.shift() ?? [];
    }),
  };
  return { transaction: { prisma } as unknown as PrismTransactionContext, calls };
}

const request = {
  idempotencyKey: 'a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5',
  recipient: { type: 'participant' as const, participationGrantId: 'a78bde2c-61a4-4e5f-b9ba-dbe21ca203b6' },
  awardKind: 'points' as const,
  label: 'Round winner',
  points: 25,
};

describe('EventGamesAwardPrismaStoreAdapter', () => {
  it('stores participant points as one idempotent award and score-ledger entry', async () => {
    const { transaction, calls } = transactionWithQueryRows(
      [{ status: 'completed' }],
      [{ participation_grant_id: request.recipient.participationGrantId, team_id: null, label: 'Player 1' }],
      [],
      [{ id: 'award-1' }],
    );
    const store = new EventGamesAwardPrismaStoreAdapter();

    await expect(store.assignAward({
      eventId: 'event-1', sessionId: 'session-1', actorId: 'host-1', request,
      now: new Date('2026-10-16T12:00:00Z'),
    }, transaction)).resolves.toEqual({
      id: 'award-1', sessionId: 'session-1', recipientType: 'participant', recipientLabel: 'Player 1',
      awardKind: 'points', label: 'Round winner', points: 25, prizeReference: null,
      assignedAt: '2026-10-16T12:00:00.000Z',
    });
    expect(calls[0]?.sql).toContain('FOR UPDATE');
    expect(calls[3]?.sql).toContain('ON CONFLICT ("event_id", "session_id", "source_event_id", "recipient_key") DO NOTHING');
    expect(calls[3]?.sql).toContain('INSERT INTO "event_games"."score_ledger"');
    expect(calls[3]?.values).toContain('host-1');
  });

  it('requires a server-assigned team and replays an exact duplicate award', async () => {
    const teamRequest = {
      ...request,
      recipient: { type: 'team' as const, teamId: 'a78bde2c-61a4-4e5f-b9ba-dbe21ca203b7' },
      awardKind: 'badge' as const,
      points: undefined,
    };
    const { transaction, calls } = transactionWithQueryRows(
      [{ status: 'completed' }],
      [{ participation_grant_id: null, team_id: teamRequest.recipient.teamId, label: 'Blue Team' }],
      [{ id: 'award-2', session_id: 'session-1', recipient_type: 'team', recipient_key: `team:${teamRequest.recipient.teamId}`,
        recipient_label: 'Blue Team', award_kind: 'badge', label: 'Round winner', points: null, prize_reference: null,
        created_at: new Date('2026-10-16T12:00:00Z'), assigned_by: 'host-1' }],
    );
    const store = new EventGamesAwardPrismaStoreAdapter();

    await expect(store.assignAward({
      eventId: 'event-1', sessionId: 'session-1', actorId: 'host-1', request: teamRequest,
      now: new Date('2026-10-16T12:01:00Z'),
    }, transaction)).resolves.toMatchObject({ id: 'award-2', recipientType: 'team', recipientLabel: 'Blue Team' });
    expect(calls).toHaveLength(3);
    expect(calls[1]?.sql).toContain('COUNT(DISTINCT g."team_label") = 1');
  });

  it('rejects a recipient outside the server-issued session grants before writing an award or score', async () => {
    const { transaction, calls } = transactionWithQueryRows([{ status: 'completed' }], []);

    await expect(new EventGamesAwardPrismaStoreAdapter().assignAward({
      eventId: 'event-1', sessionId: 'session-1', actorId: 'host-1', request,
      now: new Date('2026-10-16T12:00:00Z'),
    }, transaction)).resolves.toBeNull();

    expect(calls).toHaveLength(2);
    expect(calls.some(({ sql }) => sql.includes('INSERT INTO "event_games"."awards"'))).toBe(false);
    expect(calls.some(({ sql }) => sql.includes('INSERT INTO "event_games"."score_ledger"'))).toBe(false);
  });

  it('rejects an idempotency replay that changes host-awarded points instead of duplicating score', async () => {
    const changedRequest = { ...request, points: 99 };
    const { transaction, calls } = transactionWithQueryRows(
      [{ status: 'completed' }],
      [{ participation_grant_id: request.recipient.participationGrantId, team_id: null, label: 'Player 1' }],
      [{ id: 'award-1', session_id: 'session-1', recipient_type: 'participant', recipient_key: `participant:${request.recipient.participationGrantId}`,
        recipient_label: 'Player 1', award_kind: 'points', label: 'Round winner', points: request.points, prize_reference: null,
        created_at: new Date('2026-10-16T12:00:00Z'), assigned_by: 'host-1' }],
    );

    await expect(new EventGamesAwardPrismaStoreAdapter().assignAward({
      eventId: 'event-1', sessionId: 'session-1', actorId: 'host-1', request: changedRequest,
      now: new Date('2026-10-16T12:01:00Z'),
    }, transaction)).resolves.toBeNull();

    expect(calls).toHaveLength(3);
    expect(calls.some(({ sql }) => sql.includes('INSERT INTO "event_games"."score_ledger"'))).toBe(false);
  });
});
