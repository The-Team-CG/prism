import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismVerifiedEventActor } from '@prism/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRuleRegistryPort } from '../contracts/game-rule.port';
import { GameReadModelService } from './game-read-model.service';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
});

afterEach(() => vi.useRealTimers());

const credential = 'G'.repeat(43);
const now = new Date('2026-10-16T12:00:00.000Z');
const tx = { prisma: {}, correlationId: 'game-read-test', actorId: 'test' } as PrismTransactionContext;
const actor: PrismVerifiedEventActor = {
  actorId: 'admin-1', actorRole: 'pmcm_admin', email: 'admin@example.test',
} as unknown as PrismVerifiedEventActor;

function setup(overrides: {
  context?: Record<string, unknown> | null;
  eventScope?: Record<string, unknown> | null;
  rows?: { items: unknown[]; hasMore: boolean } | null;
  publicLeaderboard?: Array<{ rank: number; label: string; score: number; teamLabel?: string }>;
  currentRound?: unknown;
  mediaStorage?: { issueParticipantDownloadAuthorization: ReturnType<typeof vi.fn> };
} = {}) {
  const eventAccess = {
    assertHostAccess: vi.fn().mockResolvedValue(undefined),
    assertAdminAccess: vi.fn().mockResolvedValue(undefined),
    getResponseRetentionScope: vi.fn().mockResolvedValue(overrides.eventScope ?? {
      eventId: 'event-1', closed: true, archivedAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
  };
  const sessions = {
    getHostState: vi.fn().mockResolvedValue({
      eventId: 'event-1', sessionId: 'session-1', status: 'live', leaderboard: [],
    }),
    getHostReadContext: vi.fn().mockResolvedValue({
      kind: 'live-trivia', status: 'live', configSnapshot: {},
      startedAt: new Date('2026-10-16T11:00:00Z'), endedAt: null, pausedAt: null,
      totalPausedMs: 30_000, roundOffsetMs: 10_000,
    }),
    getPublicLeaderboard: vi.fn().mockResolvedValue(overrides.publicLeaderboard ?? []),
    getEventAnalytics: vi.fn().mockResolvedValue({
      eventId: 'event-1',
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
        sessionId: 'session-1', gameTitle: 'Trivia', kind: 'live-trivia', status: 'completed',
        participantJoins: 3, roundsAnswered: 7,
      }],
      participationOverTime: [{ date: '2026-10-16', participantJoins: 4 }],
    }),
  };
  const actionStore = {
    findParticipantActionContext: vi.fn().mockResolvedValue(overrides.context === undefined ? {
      eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', title: 'Trivia', kind: 'live-trivia',
      status: 'live', configSnapshot: { rounds: [] }, startedAt: new Date('2026-10-16T11:00:00Z'),
      endedAt: null, pausedAt: null, totalPausedMs: 30_000, roundOffsetMs: 10_000, participationGrantId: 'grant-1',
    } : overrides.context),
    getParticipantState: vi.fn().mockResolvedValue({ score: 20, hasSubmitted: true }),
    getRoundVoteCounts: vi.fn().mockResolvedValue([]),
    getRoundModerationQueue: vi.fn().mockResolvedValue([]),
    getFamilyFeudModerationQueue: vi.fn().mockResolvedValue([]),
    getApprovedRoundResponses: vi.fn().mockResolvedValue([]),
    listResponseHistory: vi.fn().mockResolvedValue(overrides.rows === undefined ? {
      items: [], hasMore: false,
    } : overrides.rows),
  };
  const transactions = {
    run: vi.fn(async (work: (transaction: PrismTransactionContext) => Promise<unknown>) => work(tx)),
  };
  const rule = {
    getCurrentRound: vi.fn().mockReturnValue(overrides.currentRound ?? {
      key: 'round-1', number: 2, total: 5, prompt: 'Q2?', deadlineAt: null,
    }),
  };
  const rules: GameRuleRegistryPort = { get: vi.fn().mockReturnValue(rule), register: vi.fn() };
  const mediaStorage = overrides.mediaStorage ?? {
    issueParticipantDownloadAuthorization: vi.fn().mockResolvedValue({
      downloadUrl: 'https://storage.example.test/signed-media',
      expiresAt: '2026-10-16T12:05:00.000Z',
    }),
  };
  const ServiceConstructor = GameReadModelService as unknown as new (...args: unknown[]) => GameReadModelService;
  const service = new ServiceConstructor(
    eventAccess, sessions, actionStore, transactions, rules, () => now, mediaStorage,
  );
  return { service, eventAccess, sessions, actionStore, transactions, rule, mediaStorage };
}

describe('GameReadModelService', () => {
  it('returns only the participant state for its exact active session grant', async () => {
    const { service, actionStore, rule, transactions } = setup();

    await expect(service.getParticipantState('session-1', credential)).resolves.toEqual({
      sessionId: 'session-1',
      game: { title: 'Trivia', kind: 'live-trivia' },
      status: 'live',
      startedAt: '2026-10-16T11:00:00.000Z',
      serverTime: '2026-10-16T12:00:00.000Z',
      currentRound: { key: 'round-1', number: 2, total: 5, deadlineAt: null },
      currentPrompt: 'Q2?',
      participant: {
        participantAlias: expect.stringMatching(/^Guest [A-F0-9]{10}$/),
        hasSubmitted: true,
        score: 20,
      },
      aggregateResults: [],
    });
    expect(actionStore.findParticipantActionContext).toHaveBeenCalledWith({
      sessionId: 'session-1', tokenDigest: createHash('sha256').update(credential).digest('hex'),
    }, tx);
    expect(rule.getCurrentRound).toHaveBeenCalledWith(expect.objectContaining({
      startedAt: new Date('2026-10-16T11:00:20.000Z'), now,
    }));
    expect(actionStore.getParticipantState).toHaveBeenCalledWith({
      eventId: 'event-1', sessionId: 'session-1', participationGrantId: 'grant-1', roundKey: 'round-1',
    }, tx);
    expect(transactions.run).toHaveBeenCalledOnce();
  });

  it('returns the server deadline and timestamp for a timed participant round', async () => {
    const { service, rule } = setup();
    rule.getCurrentRound.mockReturnValue({
      key: 'round-1', number: 2, total: 5, prompt: 'Q2?',
      deadlineAt: new Date('2026-10-16T12:00:30.000Z'),
    });

    const state = await service.getParticipantState('session-1', credential);

    expect(state).toMatchObject({
      serverTime: '2026-10-16T12:00:00.000Z',
      currentRound: {
        key: 'round-1', number: 2, total: 5,
        deadlineAt: '2026-10-16T12:00:30.000Z',
      },
    });
  });

  it('returns safe session standings to competitive-game guests without host award references', async () => {
    const { service, sessions } = setup({ publicLeaderboard: [{
      rank: 1, label: 'Blue', score: 25, teamLabel: 'Blue',
    }] });

    const state = await service.getParticipantState('session-1', credential);

    expect(state.leaderboard).toEqual([{ rank: 1, label: 'Blue', score: 25, teamLabel: 'Blue' }]);
    expect(JSON.stringify(state)).not.toContain('awardRecipient');
    expect(sessions.getPublicLeaderboard).toHaveBeenCalledWith({ eventId: 'event-1', sessionId: 'session-1' }, tx);
  });

  it('returns the persisted session result to every joined Spin the Wheel guest', async () => {
    const wheelResult = { kind: 'spin-wheel', outcomeId: 'bonus', label: 'Bonus points', points: 25 };
    const { service } = setup({ context: {
      eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', title: 'Spin the Wheel', kind: 'spin-wheel',
      status: 'live', configSnapshot: { configuration: { kind: 'spin-wheel' } },
      startedAt: new Date('2026-10-16T11:00:00Z'), endedAt: null, pausedAt: null,
      totalPausedMs: 0, roundOffsetMs: 0, participationGrantId: 'grant-1', wheelResult,
    } });

    await expect(service.getParticipantState('session-1', credential)).resolves.toMatchObject({
      sessionResult: wheelResult,
    });
  });

  it('uses the pause boundary to freeze participant round state', async () => {
    const context = {
      eventId: 'event-1', sessionId: 'session-1', title: 'Trivia', kind: 'live-trivia',
      status: 'paused', configSnapshot: {}, startedAt: new Date('2026-10-16T11:00:00Z'),
      endedAt: null, pausedAt: new Date('2026-10-16T11:59:00Z'), totalPausedMs: 30_000,
      participationGrantId: 'grant-1',
    };
    const { service, rule, actionStore } = setup({ context });

    await service.getParticipantState('session-1', credential);

    expect(rule.getCurrentRound).toHaveBeenCalledWith(expect.objectContaining({
      startedAt: new Date('2026-10-16T11:00:30Z'),
      now: new Date('2026-10-16T11:59:00Z'),
    }));
    expect(actionStore.getParticipantState).toHaveBeenCalledWith(expect.objectContaining({
      roundKey: 'round-1',
    }), tx);
  });

  it('returns only configured This or That vote totals to a participant', async () => {
    const configuration = {
      kind: 'this-or-that',
      rounds: [{ key: 'round-1', prompt: 'Tea or coffee?', options: ['Tea', 'Coffee'], durationSeconds: 30 }],
    };
    const { service, actionStore, rule } = setup({ context: {
      eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', title: 'This or That', kind: 'this-or-that',
      status: 'live', configSnapshot: { configuration }, startedAt: new Date('2026-10-16T11:00:00Z'),
      endedAt: null, pausedAt: null, totalPausedMs: 0, teamId: null, teamLabel: null, participationGrantId: 'grant-1',
    } });
    rule.getCurrentRound.mockReturnValue({
      key: 'round-1', number: 1, total: 1, prompt: 'Tea or coffee?', deadlineAt: null,
      participantData: { kind: 'this-or-that', options: ['Tea', 'Coffee'] },
    });
    actionStore.getRoundVoteCounts.mockResolvedValue([
      { label: 'Tea', count: 2 }, { label: 'not-configured', count: 90 },
    ]);

    const state = await service.getParticipantState('session-1', credential);

    expect(state.aggregateResults).toEqual([{ label: 'Tea', count: 2 }, { label: 'Coffee', count: 0 }]);
    expect(actionStore.getRoundVoteCounts).toHaveBeenCalledWith({
      eventId: 'event-1', sessionId: 'session-1', roundKey: 'round-1',
    }, tx);
    expect(JSON.stringify(state)).not.toContain('not-configured');
  });

  it('returns Would You Rather poll totals only when the organizer enabled anonymous aggregation', async () => {
    const baseConfiguration = {
      kind: 'would-you-rather',
      rounds: [{ key: 'rather-1', prompt: 'Would you rather?', options: ['Fly', 'Be invisible'], durationSeconds: 30, aggregateResults: false }],
    };
    const context = {
      eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', title: 'Would You Rather', kind: 'would-you-rather',
      status: 'live', configSnapshot: { configuration: baseConfiguration }, startedAt: new Date('2026-10-16T11:00:00Z'),
      endedAt: null, pausedAt: null, totalPausedMs: 0, teamId: null, teamLabel: null, participationGrantId: 'grant-1',
    };
    const privateMode = setup({ context });
    privateMode.rule.getCurrentRound.mockReturnValue({
      key: 'rather-1', number: 1, total: 1, prompt: 'Would you rather?', deadlineAt: null,
      participantData: { kind: 'would-you-rather', options: ['Fly', 'Be invisible'], aggregateResults: false },
    });
    await expect(privateMode.service.getParticipantState('session-1', credential)).resolves.toMatchObject({ aggregateResults: [] });
    expect(privateMode.actionStore.getRoundVoteCounts).not.toHaveBeenCalled();

    const aggregateConfiguration = {
      ...baseConfiguration,
      rounds: [{ ...baseConfiguration.rounds[0], aggregateResults: true }],
    };
    const shared = setup({ context: { ...context, configSnapshot: { configuration: aggregateConfiguration } } });
    shared.rule.getCurrentRound.mockReturnValue({
      key: 'rather-1', number: 1, total: 1, prompt: 'Would you rather?', deadlineAt: null,
      participantData: { kind: 'would-you-rather', options: ['Fly', 'Be invisible'], aggregateResults: true },
    });
    shared.actionStore.getRoundVoteCounts.mockResolvedValue([{ label: 'Fly', count: 2 }, { label: 'unexpected', count: 10 }]);
    await expect(shared.service.getParticipantState('session-1', credential)).resolves.toMatchObject({
      aggregateResults: [{ label: 'Fly', count: 2 }, { label: 'Be invisible', count: 0 }],
    });
  });

  it('exposes This or That (Solo) only as anonymous poll totals, while each state read stays participant-scoped', async () => {
    const context = {
      eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', title: 'This or That (Solo)', kind: 'this-or-that-solo',
      status: 'live', configSnapshot: { configuration: {
        kind: 'this-or-that-solo', rounds: [{ key: 'choice-1', prompt: 'Tea or coffee?', options: ['Tea', 'Coffee'], durationSeconds: 30 }],
      } }, startedAt: new Date('2026-10-16T11:00:00Z'), endedAt: null, pausedAt: null, totalPausedMs: 0,
      teamId: null, teamLabel: null, participationGrantId: 'grant-1',
    };
    const { service, actionStore, rule } = setup({ context });
    rule.getCurrentRound.mockReturnValue({
      key: 'choice-1', number: 1, total: 1, prompt: 'Tea or coffee?', deadlineAt: null,
      participantData: { kind: 'this-or-that-solo', options: ['Tea', 'Coffee'] },
    });
    actionStore.getRoundVoteCounts.mockResolvedValue([{ label: 'Tea', count: 1 }, { label: 'Coffee', count: 2 }]);

    await expect(service.getParticipantState('session-1', credential)).resolves.toMatchObject({
      aggregateResults: [{ label: 'Tea', count: 1 }, { label: 'Coffee', count: 2 }],
    });
    expect(actionStore.getParticipantState).toHaveBeenCalledWith(expect.objectContaining({ participationGrantId: 'grant-1' }), tx);
    expect(actionStore.getRoundVoteCounts).toHaveBeenCalledWith({
      eventId: 'event-1', sessionId: 'session-1', roundKey: 'choice-1',
    }, tx);
  });

  it('reveals Split the Room totals only after a host pause', async () => {
    const configuration = {
      kind: 'split-the-room',
      rounds: [{ key: 'round-1', prompt: 'Would you rather?', leftLabel: 'Left', rightLabel: 'Right', maxResponseLength: 160, durationSeconds: 30 }],
    };
    const context = {
      eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', title: 'Split the Room', kind: 'split-the-room',
      status: 'paused', configSnapshot: { configuration }, startedAt: new Date('2026-10-16T11:00:00Z'),
      endedAt: null, pausedAt: now, totalPausedMs: 0, teamId: null, teamLabel: null, participationGrantId: 'grant-1',
    };
    const { service, actionStore, rule } = setup({ context });
    rule.getCurrentRound.mockReturnValue({ key: 'round-1', number: 1, total: 1, prompt: 'Would you rather?', deadlineAt: null });
    actionStore.getRoundVoteCounts.mockResolvedValue([{ label: 'Left', count: 1 }, { label: 'Right', count: 3 }]);

    await expect(service.getParticipantState('session-1', credential)).resolves.toMatchObject({
      aggregateResults: [{ label: 'Left', count: 1 }, { label: 'Right', count: 3 }],
    });

    const live = setup({ context: { ...context, status: 'live', pausedAt: null } });
    live.rule.getCurrentRound.mockReturnValue({ key: 'round-1', number: 1, total: 1, prompt: 'Would you rather?', deadlineAt: null });
    await expect(live.service.getParticipantState('session-1', credential)).resolves.toMatchObject({ aggregateResults: [] });
    expect(live.actionStore.getRoundVoteCounts).not.toHaveBeenCalled();
    expect(live.actionStore.getApprovedRoundResponses).not.toHaveBeenCalled();
  });

  it('shows only host-approved Split the Room text to participants after pause', async () => {
    const context = {
      eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', title: 'Split the Room', kind: 'split-the-room',
      status: 'paused', configSnapshot: { configuration: {
        kind: 'split-the-room', rounds: [{ key: 'round-1', prompt: 'Pick a side', leftLabel: 'Left', rightLabel: 'Right', maxResponseLength: 160, durationSeconds: 30 }],
      } }, startedAt: new Date('2026-10-16T11:00:00Z'), endedAt: null, pausedAt: now,
      totalPausedMs: 0, teamId: null, teamLabel: null, participationGrantId: 'grant-1',
    };
    const { service, actionStore, rule } = setup({ context });
    rule.getCurrentRound.mockReturnValue({ key: 'round-1', number: 1, total: 1, prompt: 'Pick a side', deadlineAt: null });
    actionStore.getApprovedRoundResponses.mockResolvedValue(['Approved response']);

    const state = await service.getParticipantState('session-1', credential);

    expect(state.approvedResponses).toEqual(['Approved response']);
    expect(actionStore.getApprovedRoundResponses).toHaveBeenCalledWith({
      eventId: 'event-1', sessionId: 'session-1', roundKey: 'round-1',
    }, tx);
  });

  it('returns pending Split the Room text only in the authorized host read model', async () => {
    const { service, sessions, actionStore, rule } = setup();
    rule.getCurrentRound.mockReturnValue({ key: 'round-1', number: 1, total: 1, prompt: 'Pick a side', deadlineAt: null });
    sessions.getHostState.mockResolvedValue({
      eventId: 'event-1', sessionId: 'session-1', status: 'live', leaderboard: [],
    });
    sessions.getHostReadContext.mockResolvedValue({
      kind: 'split-the-room', status: 'live', configSnapshot: { configuration: {
        kind: 'split-the-room', rounds: [{ key: 'round-1', prompt: 'Pick a side', leftLabel: 'Left', rightLabel: 'Right', maxResponseLength: 160, durationSeconds: 30 }],
      } },
      startedAt: new Date('2026-10-16T11:00:00Z'), endedAt: null, pausedAt: null, totalPausedMs: 0,
    });
    actionStore.getRoundModerationQueue.mockResolvedValue([
      { id: 'submission-1', roundNumber: 1, response: 'Review this response' },
    ]);

    const state = await service.getHostState('event-1', 'session-1', actor);

    expect(state.currentRound).toMatchObject({
      pendingSubmissions: [{ id: 'submission-1', roundNumber: 1, response: 'Review this response' }],
    });
    expect(actionStore.getRoundModerationQueue).toHaveBeenCalledWith({
      eventId: 'event-1', sessionId: 'session-1', roundKey: 'round-1',
    }, tx);
  });

  it('hides participant state when the credential is absent, invalid, or not granted', async () => {
    const invalidCredential = setup();
    await expect(invalidCredential.service.getParticipantState('session-1', 'caller-token'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(invalidCredential.actionStore.findParticipantActionContext).not.toHaveBeenCalled();

    const unknown = setup({ context: null });
    await expect(unknown.service.getParticipantState('session-1', credential))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('uses the host-only event access check for the separate host state', async () => {
    const { service, eventAccess, sessions } = setup();

    await expect(service.getHostState('event-1', 'session-1', actor)).resolves.toMatchObject({
      sessionId: 'session-1', leaderboard: [],
    });
    expect(eventAccess.assertHostAccess).toHaveBeenCalledWith('event-1', actor);
    expect(sessions.getHostState).toHaveBeenCalledWith({ eventId: 'event-1', sessionId: 'session-1' }, tx);
    expect(sessions.getHostReadContext).toHaveBeenCalledWith({ eventId: 'event-1', sessionId: 'session-1' }, tx);
    expect(sessions.getHostReadContext).toHaveBeenCalledOnce();
  });

  it('reveals a trivia answer only to an authorized host after the host pauses the round', async () => {
    const { service, sessions, rule } = setup();
    rule.getCurrentRound.mockReturnValue({
      key: 'round-1', number: 1, total: 1, prompt: 'Which answer?', deadlineAt: null,
    });
    sessions.getHostState.mockResolvedValue({
      eventId: 'event-1', sessionId: 'session-1', status: 'paused', leaderboard: [],
    });
    sessions.getHostReadContext.mockResolvedValue({
      kind: 'live-trivia', status: 'paused', configSnapshot: { configuration: {
        kind: 'live-trivia', rounds: [{
          key: 'round-1', prompt: 'Which answer?', options: ['A', 'B'], correctAnswer: 'B',
          points: 10, durationSeconds: 30,
        }],
      } },
      startedAt: new Date('2026-10-16T11:00:00Z'), endedAt: null,
      pausedAt: new Date('2026-10-16T11:00:20Z'), totalPausedMs: 0,
    });

    await expect(service.getHostState('event-1', 'session-1', actor)).resolves.toMatchObject({
      status: 'paused',
      currentRound: {
        key: 'round-1', number: 1, total: 1, prompt: 'Which answer?', revealedAnswer: 'B',
      },
    });
  });

  it('reveals Family Feud answer board only in the host state after pause', async () => {
    const { service, sessions, rule } = setup();
    rule.getCurrentRound.mockReturnValue({
      key: 'round-1', number: 1, total: 1, prompt: 'Name a popular fruit.', deadlineAt: null,
    });
    sessions.getHostState.mockResolvedValue({
      eventId: 'event-1', sessionId: 'session-1', status: 'paused', leaderboard: [],
    });
    sessions.getHostReadContext.mockResolvedValue({
      kind: 'family-feud', status: 'paused', configSnapshot: { configuration: {
        kind: 'family-feud',
        teams: [
          { id: '00000000-0000-4000-8000-000000000101', label: 'Blue' },
          { id: '00000000-0000-4000-8000-000000000102', label: 'Gold' },
        ],
        rounds: [{ key: 'round-1', prompt: 'Name a popular fruit.', durationSeconds: 30,
          answers: [{ answer: 'Mango', alternatives: ['Mangga'], points: 10 }] }],
      } },
      startedAt: new Date('2026-10-16T11:00:00Z'), endedAt: null,
      pausedAt: new Date('2026-10-16T11:00:20Z'), totalPausedMs: 0,
    });

    await expect(service.getHostState('event-1', 'session-1', actor)).resolves.toMatchObject({
      currentRound: { answerBoard: [{ answer: 'Mango', alternatives: ['Mangga'], points: 10 }] },
    });
  });

  it('gives only the host read model the live Family Feud answer board and pending text for adjudication', async () => {
    const { service, sessions, actionStore, rule } = setup();
    rule.getCurrentRound.mockReturnValue({
      key: 'round-1', number: 1, total: 1, prompt: 'Name a popular fruit.', deadlineAt: null,
    });
    sessions.getHostState.mockResolvedValue({
      eventId: 'event-1', sessionId: 'session-1', status: 'live', leaderboard: [],
    });
    sessions.getHostReadContext.mockResolvedValue({
      kind: 'family-feud', status: 'live', configSnapshot: { configuration: {
        kind: 'family-feud',
        teams: [
          { id: '00000000-0000-4000-8000-000000000101', label: 'Blue' },
          { id: '00000000-0000-4000-8000-000000000102', label: 'Gold' },
        ],
        rounds: [{ key: 'round-1', prompt: 'Name a popular fruit.', durationSeconds: 30,
          answers: [{ answer: 'Mango', alternatives: ['Mangga'], points: 10 }] }],
      } },
      startedAt: new Date('2026-10-16T11:00:00Z'), endedAt: null, pausedAt: null, totalPausedMs: 0,
    });
    actionStore.getFamilyFeudModerationQueue.mockResolvedValue([
      { id: 'submission-1', roundNumber: 1, answer: 'Mangga' },
    ]);

    const state = await service.getHostState('event-1', 'session-1', actor);

    expect(state.currentRound).toMatchObject({
      answerBoard: [{ answer: 'Mango', alternatives: ['Mangga'], points: 10 }],
      pendingAnswers: [{ id: 'submission-1', roundNumber: 1, answer: 'Mangga' }],
    });
    expect(actionStore.getFamilyFeudModerationQueue).toHaveBeenCalledWith({
      eventId: 'event-1', sessionId: 'session-1', roundKey: 'round-1',
    }, tx);
  });

  it('keeps Family Feud answer-board data and pending answers out of participant state', async () => {
    const { service, actionStore, rule } = setup({ context: {
      eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', title: 'Family Feud',
      kind: 'family-feud', status: 'live', configSnapshot: { configuration: {
        kind: 'family-feud',
        teams: [
          { id: '00000000-0000-4000-8000-000000000101', label: 'Blue' },
          { id: '00000000-0000-4000-8000-000000000102', label: 'Gold' },
        ],
        rounds: [{ key: 'round-1', prompt: 'Name a popular fruit.', durationSeconds: 30,
          answers: [{ answer: 'Mango', alternatives: ['Mangga'], points: 10 }] }],
      } },
      startedAt: new Date('2026-10-16T11:00:00Z'), endedAt: null, pausedAt: null,
      totalPausedMs: 0, roundOffsetMs: 0, teamId: 'team-1', teamLabel: 'Blue', participationGrantId: 'grant-1',
    } });
    rule.getCurrentRound.mockReturnValue({
      key: 'round-1', number: 1, total: 1, prompt: 'Name a popular fruit.', deadlineAt: null,
      participantData: { kind: 'family-feud', teamLabel: 'Blue' },
    });

    const state = await service.getParticipantState('session-1', credential);

    expect(JSON.stringify(state)).not.toContain('Mango');
    expect(JSON.stringify(state)).not.toContain('Mangga');
    expect(state.currentRound).toEqual({ key: 'round-1', number: 1, total: 1, deadlineAt: null });
    expect(actionStore.getFamilyFeudModerationQueue).not.toHaveBeenCalled();
  });

  it('keeps the trivia answer hidden from live hosts until pause and from participant reads', async () => {
    const configuration = { configuration: {
      kind: 'live-trivia', rounds: [{
        key: 'round-1', prompt: 'Which answer?', options: ['A', 'B'], correctAnswer: 'B',
        points: 10, durationSeconds: 30,
      }],
    } };
    const live = setup({ context: {
      eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', title: 'Trivia',
      kind: 'live-trivia', status: 'live', configSnapshot: configuration,
      startedAt: new Date('2026-10-16T11:00:00Z'), endedAt: null, pausedAt: null,
      totalPausedMs: 0, participationGrantId: 'grant-1',
    } });
    live.rule.getCurrentRound.mockReturnValue({
      key: 'round-1', number: 1, total: 1, prompt: 'Which answer?', deadlineAt: null,
    });
    const participantState = await live.service.getParticipantState('session-1', credential);
    expect(participantState).toMatchObject({
      currentPrompt: 'Which answer?',
      participant: { hasSubmitted: true, score: 20 },
    });
    expect(participantState).not.toHaveProperty('revealedAnswer');

    const { service, sessions, rule } = setup();
    rule.getCurrentRound.mockReturnValue({
      key: 'round-1', number: 1, total: 1, prompt: 'Which answer?', deadlineAt: null,
    });
    sessions.getHostReadContext.mockResolvedValue({
      kind: 'live-trivia', status: 'live', configSnapshot: configuration,
      startedAt: new Date('2026-10-16T11:00:00Z'), endedAt: null, pausedAt: null, totalPausedMs: 0,
    });

    const hostState = await service.getHostState('event-1', 'session-1', actor);
    expect(hostState.currentRound).not.toHaveProperty('revealedAnswer');
  });

  it('rejects event analytics before reading data when host access fails', async () => {
    const { service, eventAccess, sessions, transactions } = setup();
    eventAccess.assertHostAccess.mockRejectedValue(new ForbiddenException());

    await expect(service.getEventAnalytics('event-1', actor)).rejects.toBeInstanceOf(ForbiddenException);

    expect(sessions.getEventAnalytics).not.toHaveBeenCalled();
    expect(transactions.run).not.toHaveBeenCalled();
  });

  it('requires a closed event and PMCM Admin before reading paged responses', async () => {
    const open = setup({ eventScope: { eventId: 'event-1', closed: false, archivedAt: null } });
    await expect(open.service.getResponseHistory('event-1', 'session-1', actor))
      .rejects.toBeInstanceOf(ConflictException);
    expect(open.actionStore.listResponseHistory).not.toHaveBeenCalled();

    const closed = setup({ rows: { items: [], hasMore: false } });
    await expect(closed.service.getResponseHistory('event-1', 'session-1', actor, { limit: 25 }))
      .resolves.toMatchObject({ sessionId: 'session-1', items: [], limit: 25, hasMore: false });
    expect(closed.eventAccess.assertAdminAccess).toHaveBeenCalledWith('event-1', actor);
    expect(closed.actionStore.listResponseHistory).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'event-1', sessionId: 'session-1', now,
      archivedAt: new Date('2026-01-01T00:00:00.000Z'), limit: 25,
    }), tx);
  });

  it('returns event-scoped aggregates to authorized hosts without participant details', async () => {
    const { service, eventAccess, sessions } = setup();

    await expect(service.getEventAnalytics('event-1', actor)).resolves.toEqual({
      eventId: 'event-1',
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
        sessionId: 'session-1', gameTitle: 'Trivia', kind: 'live-trivia', status: 'completed',
        participantJoins: 3, roundsAnswered: 7,
      }],
      participationOverTime: [{ date: '2026-10-16', participantJoins: 4 }],
    });
    expect(eventAccess.assertHostAccess).toHaveBeenCalledWith('event-1', actor);
    expect(sessions.getEventAnalytics).toHaveBeenCalledWith('event-1', tx);
  });
  it('authorizes only the current published game image for a verified active participant', async () => {
    const mediaObjectId = 'obj_00000000-0000-4000-8000-000000000101';
    const mediaStorage = {
      issueParticipantDownloadAuthorization: vi.fn().mockResolvedValue({
        downloadUrl: 'https://storage.example.test/signed-media',
        expiresAt: '2026-10-16T12:05:00.000Z',
      }),
    };
    const { service, actionStore } = setup({
      context: {
        eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', title: 'Picture',
        kind: 'guess-picture', status: 'live', configSnapshot: {
          mediaObjectIds: [mediaObjectId],
          configuration: {
            kind: 'guess-picture', mediaObjectId, acceptedAnswers: ['cat'],
            stages: [{ afterSeconds: 0, hint: 'First hint', points: 10 }],
          },
        },
        startedAt: new Date('2026-10-16T11:00:00Z'), endedAt: null, pausedAt: null,
        totalPausedMs: 0, participationGrantId: 'grant-1',
      },
      currentRound: {
        key: 'picture-1', number: 1, total: 1, prompt: 'First hint', deadlineAt: null,
        participantData: { kind: 'guess-picture', mediaObjectId, stage: 1 },
      },
      mediaStorage,
    });
    await expect(service.getParticipantMediaAuthorization('session-1', mediaObjectId, credential))
      .resolves.toEqual({
        downloadUrl: 'https://storage.example.test/signed-media',
        expiresAt: '2026-10-16T12:05:00.000Z',
      });
    expect(actionStore.findParticipantActionContext).toHaveBeenCalledWith({
      sessionId: 'session-1', tokenDigest: createHash('sha256').update(credential).digest('hex'),
    }, tx);
    expect(mediaStorage.issueParticipantDownloadAuthorization).toHaveBeenCalledWith({
      eventId: 'event-1', gameId: 'game-1', objectId: mediaObjectId,
    }, tx);
  });

  it('denies configured assets from other rounds and media before a game reaches live state', async () => {
    const currentOriginal = 'obj_00000000-0000-4000-8000-000000000101';
    const currentComparison = 'obj_00000000-0000-4000-8000-000000000102';
    const futureOriginal = 'obj_00000000-0000-4000-8000-000000000103';
    const futureComparison = 'obj_00000000-0000-4000-8000-000000000104';
    const configuredIds = [currentOriginal, currentComparison, futureOriginal, futureComparison];
    const context = {
      eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', title: 'Spot the Difference',
      kind: 'spot-the-difference', status: 'live', configSnapshot: {
        mediaObjectIds: configuredIds,
        configuration: {
          kind: 'spot-the-difference', rounds: [
            { key: 'round-1', originalMediaObjectId: currentOriginal, comparisonMediaObjectId: currentComparison },
            { key: 'round-2', originalMediaObjectId: futureOriginal, comparisonMediaObjectId: futureComparison },
          ],
        },
      },
      startedAt: new Date('2026-10-16T11:00:00Z'), endedAt: null, pausedAt: null,
      totalPausedMs: 0, roundOffsetMs: 0, teamId: null, teamLabel: null, participationGrantId: 'grant-1',
    };
    const currentRound = {
      key: 'round-1', number: 1, total: 2, prompt: 'Find differences', deadlineAt: new Date('2026-10-16T12:01:00Z'),
      participantData: {
        kind: 'spot-the-difference', originalMediaObjectId: currentOriginal,
        comparisonMediaObjectId: currentComparison, totalDifferences: 2,
      },
    };
    const futureAsset = setup({ context, currentRound });
    await expect(futureAsset.service.getParticipantMediaAuthorization('session-1', futureOriginal, credential))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(futureAsset.mediaStorage.issueParticipantDownloadAuthorization).not.toHaveBeenCalled();

    const lobby = setup({ context: { ...context, status: 'lobby' }, currentRound });
    await expect(lobby.service.getParticipantMediaAuthorization('session-1', currentOriginal, credential))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(lobby.mediaStorage.issueParticipantDownloadAuthorization).not.toHaveBeenCalled();
  });

  it('denies guessed and ended-session media before requesting storage authorization', async () => {
    const mediaObjectId = 'obj_00000000-0000-4000-8000-000000000101';
    const guessed = setup();
    await expect(guessed.service.getParticipantMediaAuthorization('session-1', mediaObjectId, credential))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(guessed.mediaStorage.issueParticipantDownloadAuthorization).not.toHaveBeenCalled();

    const ended = setup({ context: {
      eventId: 'event-1', sessionId: 'session-1', gameId: 'game-1', title: 'Trivia',
      kind: 'live-trivia', status: 'completed', configSnapshot: { mediaObjectIds: [mediaObjectId] },
      startedAt: new Date('2026-10-16T11:00:00Z'), endedAt: now, pausedAt: null,
      totalPausedMs: 0, participationGrantId: 'grant-1',
    } });
    await expect(ended.service.getParticipantMediaAuthorization('session-1', mediaObjectId, credential))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(ended.mediaStorage.issueParticipantDownloadAuthorization).not.toHaveBeenCalled();
  });
});
