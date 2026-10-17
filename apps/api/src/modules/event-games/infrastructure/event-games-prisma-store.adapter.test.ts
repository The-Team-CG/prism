import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { EventGamesPrismaStoreAdapter } from './event-games-prisma-store.adapter';

describe('EventGamesPrismaStoreAdapter event analytics', () => {
  it('does not archive a game definition after a session has started', async () => {
    const queryRaw = vi.fn().mockResolvedValueOnce([]);
    const transaction = { prisma: { $queryRaw: queryRaw } } as unknown as PrismTransactionContext;

    await expect(new EventGamesPrismaStoreAdapter().removeUnstartedGame({
      eventId: 'event-1', gameId: 'game-1', actorId: 'host-1',
    }, transaction)).resolves.toBeNull();

    const sql = (queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join(' ');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('"started_at" IS NOT NULL');
  });

  it('maps event-scoped aggregate rows without participant details', async () => {
    const eventId = 'event-1';
    const queryRaw = vi.fn()
      .mockResolvedValueOnce([{
        games_created: 2n,
        sessions_started: 2n,
        sessions_completed: 1n,
        distinct_event_participants: 3n,
        participant_joins: 4n,
        rounds_answered: 8n,
      }])
      .mockResolvedValueOnce([{
        session_id: 'session-1',
        game_title: 'Trivia',
        game_kind: 'live-trivia',
        status: 'completed',
        participant_joins: 3n,
        rounds_answered: 7n,
      }])
      .mockResolvedValueOnce([{ date: '2026-10-16', participant_joins: 4n }]);
    const transaction = { prisma: { $queryRaw: queryRaw } } as unknown as PrismTransactionContext;

    await expect(new EventGamesPrismaStoreAdapter().getEventAnalytics(eventId, transaction)).resolves.toEqual({
      eventId,
      totals: {
        gamesCreated: 2,
        sessionsStarted: 2,
        sessionsCompleted: 1,
        distinctEventParticipants: 3,
        participantJoins: 4,
        roundsAnswered: 8,
        completionRate: 0.5,
      },
      sessions: [{
        sessionId: 'session-1',
        gameTitle: 'Trivia',
        kind: 'live-trivia',
        status: 'completed',
        participantJoins: 3,
        roundsAnswered: 7,
      }],
      participationOverTime: [{ date: '2026-10-16', participantJoins: 4 }],
    });

    const calls = queryRaw.mock.calls as unknown as Array<[TemplateStringsArray, ...unknown[]]>;
    expect(calls).toHaveLength(3);
    expect(calls.map(([strings]) => strings.join('?')).join('\n'))
      .toContain('COUNT(DISTINCT (a."participation_grant_id", a."round_key"))');
    for (const [strings, ...values] of calls) {
      expect(strings.join('?')).toContain('"event_id" = ?');
      expect(values).toContain(eventId);
    }
  });

  it('returns event-scoped award recipients only with the protected host leaderboard', async () => {
    const queryRaw = vi.fn()
      .mockResolvedValueOnce([{
        event_id: 'event-1',
        session_id: 'session-1',
        game_id: 'game-1',
        title: 'Trivia',
        game_kind: 'live-trivia',
        status: 'live',
        scheduled_start_at: null,
        started_at: new Date('2026-10-16T09:00:00.000Z'),
        ended_at: null,
        participant_count: 2,
      }])
      .mockResolvedValueOnce([
        {
          group_key: 'participant:participation-1',
          team_id: null,
          team_label: null,
          score: 100,
          rank: 1,
        },
        {
          group_key: 'team:team-1',
          team_id: 'team-1',
          team_label: 'Blue',
          score: 80,
          rank: 2,
        },
      ]);
    const transaction = { prisma: { $queryRaw: queryRaw } } as unknown as PrismTransactionContext;

    await expect(new EventGamesPrismaStoreAdapter().getHostState(
      { eventId: 'event-1', sessionId: 'session-1' },
      transaction,
    )).resolves.toMatchObject({
      leaderboard: [
        {
          rank: 1,
          label: 'Player 1',
          awardRecipient: { type: 'participant', participationGrantId: 'participation-1' },
        },
        {
          rank: 2,
          label: 'Blue',
          teamLabel: 'Blue',
          awardRecipient: { type: 'team', teamId: 'team-1' },
        },
      ],
    });
  });

  it('rejects counts that cannot be represented safely as numbers', async () => {
    const queryRaw = vi.fn().mockResolvedValueOnce([{
      games_created: 9007199254740992n,
      sessions_started: 0n,
      sessions_completed: 0n,
      distinct_event_participants: 0n,
      participant_joins: 0n,
      rounds_answered: 0n,
    }]);
    const transaction = { prisma: { $queryRaw: queryRaw } } as unknown as PrismTransactionContext;

    await expect(new EventGamesPrismaStoreAdapter().getEventAnalytics('event-1', transaction))
      .rejects.toThrow('Persisted event game analytics count is invalid');
    expect(queryRaw).toHaveBeenCalledOnce();
  });
});
