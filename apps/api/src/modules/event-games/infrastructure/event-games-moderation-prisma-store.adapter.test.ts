import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { EventGamesModerationPrismaStoreAdapter } from './event-games-moderation-prisma-store.adapter';

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
  action: 'hide_submission' as const,
  idempotencyKey: '00000000-0000-4000-8000-000000000101',
  submissionId: '00000000-0000-4000-8000-000000000102',
  reason: 'Contains personal information',
};
const familyFeudRequest = {
  action: 'resolve_family_feud_answer' as const,
  idempotencyKey: '00000000-0000-4000-8000-000000000105',
  submissionId: '00000000-0000-4000-8000-000000000106',
  boardAnswer: 'Mango',
};
const familyFeudSession = {
  status: 'live',
  game_kind: 'family-feud',
  config_snapshot: { configuration: {
    kind: 'family-feud',
    teams: [
      { id: '00000000-0000-4000-8000-000000000101', label: 'Blue' },
      { id: '00000000-0000-4000-8000-000000000102', label: 'Gold' },
    ],
    rounds: [{ key: 'round-1', prompt: 'Name a popular fruit.', durationSeconds: 30,
      answers: [{ answer: 'Mango', alternatives: ['Mangga'], points: 10 }] }],
  } },
};

describe('EventGamesModerationPrismaStoreAdapter', () => {
  it('locks the session and records an event-scoped, audited hide action', async () => {
    const { transaction, calls } = transactionWithQueryRows(
      [{ status: 'live' }],
      [],
      [{ id: request.submissionId, moderation_action: null }],
      [{ id: 'moderation-row' }],
    );
    const store = new EventGamesModerationPrismaStoreAdapter();

    await expect(store.applyModeration({
      eventId: 'event-1', sessionId: 'session-1', actorId: 'host-1', request,
      now: new Date('2026-10-16T12:00:00Z'),
    }, transaction)).resolves.toEqual({
      id: expect.stringMatching(/^moderation_[a-f0-9]{64}$/),
      targetId: request.submissionId,
      beforeStatus: 'pending',
      afterStatus: 'hidden',
    });
    expect(calls).toHaveLength(4);
    expect(calls[0]?.sql).toContain('FOR UPDATE');
    expect(calls[2]?.sql).toContain('s."event_id" = ? AND s."session_id" = ?');
    expect(calls[2]?.sql).toContain('FOR UPDATE OF s');
    expect(calls[3]?.sql).toContain('INSERT INTO "event_games"."moderation_actions"');
    expect(calls[3]?.values).toContain('host-1');
    expect(calls[3]?.values).toContain(request.reason);
  });

  it('revokes only an active grant in the same event and session', async () => {
    const remove = {
      action: 'remove_participant' as const,
      idempotencyKey: request.idempotencyKey,
      participationGrantId: 'grant-1',
      reason: 'Abusive conduct',
    };
    const { transaction, calls } = transactionWithQueryRows(
      [{ status: 'paused' }], [], [{ id: 'grant-1', revoked_at: null }], [{ id: 'grant-1' }], [{ id: 'mod-1' }],
    );
    const store = new EventGamesModerationPrismaStoreAdapter();

    await expect(store.applyModeration({
      eventId: 'event-1', sessionId: 'session-1', actorId: 'host-1', request: remove,
      now: new Date('2026-10-16T12:00:00Z'),
    }, transaction)).resolves.toMatchObject({ targetId: 'grant-1', beforeStatus: 'active', afterStatus: 'revoked' });
    expect(calls[2]?.sql).toContain('"id" = ?');
    expect(calls[3]?.sql).toContain('UPDATE "event_games"."session_participation_grants"');
    expect(calls[3]?.sql).toContain('"revoked_at" IS NULL');
    expect(calls[4]?.sql).toContain('"participation_grant_id"');
  });

  it('replays an identical moderation request and refuses a changed target or reason', async () => {
    const { transaction } = transactionWithQueryRows(
      [{ status: 'completed' }], [{
        id: 'moderation-row', action: 'hide_submission', submission_id: request.submissionId,
        participation_grant_id: null, reason: request.reason,
      }],
    );
    const store = new EventGamesModerationPrismaStoreAdapter();

    await expect(store.applyModeration({
      eventId: 'event-1', sessionId: 'session-1', actorId: 'host-1', request,
      now: new Date('2026-10-16T12:00:00Z'),
    }, transaction)).resolves.toMatchObject({ id: 'moderation-row', afterStatus: 'hidden' });
  });

  it('replays the same Family Feud board decision but rejects changed decision reuse', async () => {
    const existing = {
      id: 'moderation-row', action: 'resolve_family_feud_answer',
      submission_id: familyFeudRequest.submissionId, participation_grant_id: null,
      reason: null, resolved_answer: 'Mango',
    };
    const { transaction } = transactionWithQueryRows([familyFeudSession], [existing]);
    const store = new EventGamesModerationPrismaStoreAdapter();

    await expect(store.applyModeration({
      eventId: 'event-1', sessionId: 'session-1', actorId: 'host-1', request: familyFeudRequest,
      now: new Date('2026-10-17T12:00:00Z'),
    }, transaction)).resolves.toMatchObject({ id: 'moderation-row', afterStatus: 'visible' });

    const changed = transactionWithQueryRows([familyFeudSession], [existing]);
    await expect(store.applyModeration({
      eventId: 'event-1', sessionId: 'session-1', actorId: 'host-1',
      request: { ...familyFeudRequest, boardAnswer: null }, now: new Date('2026-10-17T12:00:00Z'),
    }, changed.transaction)).resolves.toBeNull();
  });

  it('derives Family Feud points from the frozen answer board and records the host decision once', async () => {
    const { transaction, calls } = transactionWithQueryRows(
      [familyFeudSession],
      [],
      [{ id: familyFeudRequest.submissionId, round_key: 'round-1', action_kind: 'answer',
        payload: { answer: 'Mangga' }, score_result: { points: 0, isCorrect: false },
        participation_grant_id: 'grant-1', moderation_action: null }],
      [{ id: 'ledger-1' }],
      [{ id: familyFeudRequest.submissionId }],
      [{ id: 'moderation-1' }],
    );
    const store = new EventGamesModerationPrismaStoreAdapter();

    await expect(store.applyModeration({
      eventId: 'event-1', sessionId: 'session-1', actorId: 'host-1', request: familyFeudRequest,
      now: new Date('2026-10-17T12:00:00Z'),
    }, transaction)).resolves.toEqual({
      id: expect.stringMatching(/^moderation_[a-f0-9]{64}$/),
      targetId: familyFeudRequest.submissionId,
      beforeStatus: 'pending',
      afterStatus: 'visible',
    });

    expect(calls).toHaveLength(6);
    expect(calls[0]?.sql).toContain('FOR UPDATE OF s');
    expect(calls[3]?.sql).toContain('UPDATE "event_games"."score_ledger"');
    expect(calls[3]?.values).toContain(10);
    expect(calls[4]?.sql).toContain('UPDATE "event_games"."submissions"');
    expect(calls[4]?.values).toContain('{"points":10,"isCorrect":true}');
    expect(calls[5]?.sql).toContain('"resolved_answer"');
    expect(calls[5]?.values).toContain('Mango');
  });

  it('records an explicit no-award decision and refuses a host-supplied answer outside the frozen board', async () => {
    const noAwardRequest = { ...familyFeudRequest, boardAnswer: null };
    const { transaction, calls } = transactionWithQueryRows(
      [familyFeudSession], [],
      [{ id: familyFeudRequest.submissionId, round_key: 'round-1', action_kind: 'answer',
        payload: { answer: 'unlisted answer' }, score_result: { points: 0, isCorrect: false },
        participation_grant_id: 'grant-1', moderation_action: null }],
      [{ id: 'ledger-1' }], [{ id: familyFeudRequest.submissionId }], [{ id: 'moderation-2' }],
    );
    const store = new EventGamesModerationPrismaStoreAdapter();

    await expect(store.applyModeration({
      eventId: 'event-1', sessionId: 'session-1', actorId: 'host-1', request: noAwardRequest,
      now: new Date('2026-10-17T12:00:00Z'),
    }, transaction)).resolves.toMatchObject({ afterStatus: 'hidden' });
    expect(calls[3]?.values).toContain(0);
    expect(calls[5]?.values).toContain(null);

    const invalid = transactionWithQueryRows(
      [familyFeudSession], [],
      [{ id: familyFeudRequest.submissionId, round_key: 'round-1', action_kind: 'answer',
        payload: { answer: 'unlisted answer' }, score_result: { points: 0, isCorrect: false },
        participation_grant_id: 'grant-1', moderation_action: null }],
    );
    await expect(store.applyModeration({
      eventId: 'event-1', sessionId: 'session-1', actorId: 'host-1',
      request: { ...familyFeudRequest, boardAnswer: 'Arbitrary points' }, now: new Date(),
    }, invalid.transaction)).resolves.toBeNull();
    expect(invalid.calls).toHaveLength(3);
  });
});
