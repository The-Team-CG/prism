import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventGamesActionPrismaStoreAdapter } from './event-games-action-prisma-store.adapter';

const result = { kind: 'singleplayer-choice' as const, option: 'Tea' };
const wheelResult = { kind: 'spin-wheel' as const, outcomeId: 'large', label: 'Large prize', points: 40 };
function transactionWithQueryResults(...responses: unknown[]) {
  const queryRaw = vi.fn();
  for (const response of responses) queryRaw.mockResolvedValueOnce(response);
  return {
    transaction: { prisma: { $queryRaw: queryRaw } } as unknown as PrismTransactionContext,
    queryRaw,
  };
}

describe('EventGamesActionPrismaStoreAdapter participant state and action persistence', () => {
  let input: Parameters<EventGamesActionPrismaStoreAdapter['recordParticipantAction']>[0];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T10:00:00Z'));
    input = {
      eventId: 'event-1', sessionId: 'session-1', participationGrantId: 'grant-1',
      tokenDigest: 'a'.repeat(64), roundKey: 'choice-1', roundNumber: 1,
      actionKind: 'complete', payload: { option: 'Tea' },
      points: 0, isCorrect: false, result, deadlineAt: null, createdAt: new Date(),
    };
  });

  afterEach(() => vi.useRealTimers());

  it('persists a participant-specific solo choice beside its score', async () => {
    const { transaction, queryRaw } = transactionWithQueryResults(
      [{ submission_id: 'submission-1' }],
      [{ score: 0 }],
    );

    await expect(new EventGamesActionPrismaStoreAdapter().recordParticipantAction(input, transaction))
      .resolves.toEqual({ points: 0, result });

    expect(queryRaw.mock.calls[0]).toContain(JSON.stringify({ points: 0, isCorrect: false, result }));
  });

  it('persists a server-selected Family Feud team assignment in the same transaction as the response', async () => {
    const teamId = '00000000-0000-4000-8000-000000000101';
    const teamLabel = 'Blue';
    const teamInput = {
      ...input,
      actionKind: 'answer' as const,
      payload: { answer: 'Mango' },
      result: undefined,
      points: 10,
      isCorrect: true,
      teamAssignment: { teamId, teamLabel },
    };
    const { transaction, queryRaw } = transactionWithQueryResults(
      [{ submission_id: 'submission-team' }],
      [{ score: 10 }],
    );

    await expect(new EventGamesActionPrismaStoreAdapter().recordParticipantAction(teamInput, transaction))
      .resolves.toEqual({ points: 10 });

    const sql = Array.from(queryRaw.mock.calls[0]?.[0] ?? []).join(' ');
    expect(sql).toContain('UPDATE "event_games"."session_participation_grants"');
    expect(queryRaw.mock.calls[0]).toContain(teamId);
    expect(queryRaw.mock.calls[0]).toContain(teamLabel);
  });

  it('returns the persisted private solo choice in the scoped participant state read', async () => {
    const { transaction, queryRaw } = transactionWithQueryResults([{
      score: 0, has_submitted: true, has_voted: false, result,
    }]);

    await expect(new EventGamesActionPrismaStoreAdapter().getParticipantState({
      eventId: 'event-1', sessionId: 'session-1', participationGrantId: 'grant-1', roundKey: 'choice-1',
    }, transaction)).resolves.toEqual({ score: 0, hasSubmitted: true, hasVoted: false, result });
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it('reads the shared wheel outcome from the participant session context', async () => {
    const { transaction, queryRaw } = transactionWithQueryResults([{
      event_id: 'event-1', session_id: 'session-1', game_id: 'game-1', title: 'Spin the Wheel',
      game_kind: 'spin-wheel', entry_mode: 'active', available_from: null, available_until: null,
      status: 'live', config_snapshot: { configuration: { kind: 'spin-wheel' } },
      started_at: new Date('2026-10-17T10:00:00Z'), ended_at: null, paused_at: null,
      total_paused_ms: 0, round_offset_ms: 0, team_id: null, team_label: null,
      participation_grant_id: 'grant-1', wheel_result: wheelResult,
    }]);

    await expect(new EventGamesActionPrismaStoreAdapter().findParticipantActionContext({
      sessionId: 'session-1', tokenDigest: 'a'.repeat(64),
    }, transaction)).resolves.toMatchObject({
      eventId: 'event-1', sessionId: 'session-1', kind: 'spin-wheel', wheelResult,
    });

    const sql = Array.from(queryRaw.mock.calls[0]?.[0] ?? []).join(' ');
    expect(sql).toContain('s."wheel_result"');
    expect(sql).toContain('c."token_digest"');
    expect(sql).toContain('g."revoked_at" IS NULL');
  });

  it('returns only aggregate vote totals and omits hidden vote submissions', async () => {
    const { transaction, queryRaw } = transactionWithQueryResults([{ label: 'Tea', count: 2 }]);

    await expect(new EventGamesActionPrismaStoreAdapter().getRoundVoteCounts({
      eventId: 'event-1', sessionId: 'session-1', roundKey: 'round-1',
    }, transaction)).resolves.toEqual([{ label: 'Tea', count: 2 }]);

    const sql = Array.from(queryRaw.mock.calls[0]?.[0] ?? []).join(' ');
    expect(sql).toContain("s.\"action_kind\" = 'vote'");
    expect(sql).toContain("<> 'hide_submission'");
    expect(sql).not.toContain('participation_grant_id" AS');
  });

  it('returns pending bounded text for the host moderation queue without participant identifiers', async () => {
    const { transaction, queryRaw } = transactionWithQueryResults([{
      id: 'submission-1', round_number: 2, response: 'A short answer',
    }]);

    await expect(new EventGamesActionPrismaStoreAdapter().getRoundModerationQueue({
      eventId: 'event-1', sessionId: 'session-1', roundKey: 'round-2',
    }, transaction)).resolves.toEqual([{ id: 'submission-1', roundNumber: 2, response: 'A short answer' }]);

    const sql = Array.from(queryRaw.mock.calls[0]?.[0] ?? []).join(' ');
    expect(sql).toContain("s.\"action_kind\" = 'answer'");
    expect(sql).toContain("s.\"payload\"->>'response'");
    expect(sql).toContain("latest.\"action\" IS NULL");
    expect(sql).not.toContain('participation_grant_id" AS');
  });

  it('returns only unscored pending Family Feud answers to the host queue', async () => {
    const { transaction, queryRaw } = transactionWithQueryResults([{
      id: 'submission-2', round_number: 2, answer: 'Mangga',
    }]);

    await expect(new EventGamesActionPrismaStoreAdapter().getFamilyFeudModerationQueue({
      eventId: 'event-1', sessionId: 'session-1', roundKey: 'round-2',
    }, transaction)).resolves.toEqual([{ id: 'submission-2', roundNumber: 2, answer: 'Mangga' }]);

    const sql = Array.from(queryRaw.mock.calls[0]?.[0] ?? []).join(' ');
    expect(sql).toContain("definition.\"game_kind\" = 'family-feud'");
    expect(sql).toContain("s.\"payload\"->>'answer'");
    expect(sql).toContain("s.\"score_result\"->>'points' = '0'");
    expect(sql).toContain('latest.\"action\" IS NULL');
    expect(sql).not.toContain('participation_grant_id\" AS');
  });

  it('returns only approved Split the Room text for a paused participant reveal', async () => {
    const { transaction, queryRaw } = transactionWithQueryResults([
      { response: 'Approved response' },
    ]);

    await expect(new EventGamesActionPrismaStoreAdapter().getApprovedRoundResponses({
      eventId: 'event-1', sessionId: 'session-1', roundKey: 'round-1',
    }, transaction)).resolves.toEqual(['Approved response']);

    const sql = Array.from(queryRaw.mock.calls[0]?.[0] ?? []).join(' ');
    expect(sql).toContain("latest.\"action\" = 'approve_submission'");
    expect(sql).not.toContain('participation_grant_id" AS');
  });

  it('finds only events with response content old enough for retention review', async () => {
    const now = new Date('2026-10-17T00:00:00Z');
    const { transaction, queryRaw } = transactionWithQueryResults([{ event_id: 'event-1' }]);

    await expect(new EventGamesActionPrismaStoreAdapter().listResponseRetentionEventIds(now, transaction))
      .resolves.toEqual(['event-1']);

    const sql = Array.from(queryRaw.mock.calls[0]?.[0] ?? []).join(' ');
    expect(sql).toContain('SELECT DISTINCT "event_id"');
    expect(sql).toContain('"created_at" <=');
    expect(sql).toContain("INTERVAL '1 year'");
    expect(queryRaw.mock.calls[0]).toContain(now);
  });

  it('redacts expired response content while preserving moderation decisions', async () => {
    const now = new Date('2026-10-17T00:00:00Z');
    const archivedAt = new Date('2025-01-01T00:00:00Z');
    const { transaction, queryRaw } = transactionWithQueryResults([{ redacted_count: 2 }]);

    await expect(new EventGamesActionPrismaStoreAdapter().redactExpiredResponses({
      eventId: 'event-1', archivedAt, now,
    }, transaction)).resolves.toBe(2);

    const sql = Array.from(queryRaw.mock.calls[0]?.[0] ?? []).join(' ');
    expect(sql).toContain('COALESCE(latest."created_at",');
    expect(sql).toContain("INTERVAL '1 year'");
    expect(sql).toContain("SET \"payload\" = '{\"redacted\":true}'::jsonb, \"score_result\" = NULL");
    expect(sql).toContain('SET "reason" = NULL');
    expect(sql).toContain("CASE WHEN m.\"resolved_answer\" IS NULL THEN NULL ELSE '' END");
    expect(sql).not.toContain('SET "action"');
    expect(queryRaw.mock.calls[0]).toContain('event-1');
    expect(queryRaw.mock.calls[0]).toContain(archivedAt);
    expect(queryRaw.mock.calls[0]).toContain(now);
  });
});
