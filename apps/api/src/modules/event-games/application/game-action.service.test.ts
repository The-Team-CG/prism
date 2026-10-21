import { ConflictException, HttpStatus, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRuleRegistryPort } from '../contracts/game-rule.port';
import { GameActionService } from './game-action.service';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
});

afterEach(() => vi.useRealTimers());

const sessionId = 'session-1';
const credential = 'G'.repeat(43);
const action: PrismSubmitEventGameActionInput = {
  roundKey: 'round-1',
  actionKind: 'answer',
  payload: { answer: 'A' },
};
const now = new Date('2026-10-16T12:00:00.000Z');

function setup(overrides: {
  context?: Record<string, unknown> | null;
  currentRound?: Record<string, unknown> | null;
  validationErrors?: string[];
  ruleAvailable?: boolean;
  stored?: { points: number } | null;
  clock?: Date;
  rateLimiterAvailable?: boolean;
  rateLimitAllowed?: boolean;
} = {}) {
  const transaction = { prisma: {}, correlationId: 'game-action-test', actorId: 'anonymous-game-participant' } as PrismTransactionContext;
  const transactions = {
    run: vi.fn(async (work: (tx: PrismTransactionContext) => Promise<unknown>) => work(transaction)),
  };
  const context = overrides.context === undefined ? {
    eventId: 'event-1',
    sessionId,
    title: 'Live Trivia',
    kind: 'live-trivia',
    status: 'live',
    configSnapshot: { rounds: [{ key: 'round-1', prompt: 'Question?' }] },
    startedAt: new Date('2026-10-16T11:59:00.000Z'),
    endedAt: null,
    pausedAt: null,
    totalPausedMs: 0,
    roundOffsetMs: 0,
    teamId: null,
    teamLabel: null,
    participationGrantId: 'grant-1',
  } : overrides.context;
  const store = {
    findParticipantActionContext: vi.fn().mockResolvedValue(context),
    recordParticipantAction: vi.fn().mockResolvedValue(overrides.stored === undefined ? { points: 20 } : overrides.stored),
  };
  const rule = {
    getCurrentRound: vi.fn().mockReturnValue(overrides.currentRound === undefined ? {
      key: 'round-1', number: 1, total: 3, prompt: 'Question?', deadlineAt: new Date(now.getTime() + 1_000),
    } : overrides.currentRound),
    validateSubmission: vi.fn().mockReturnValue(overrides.validationErrors ?? []),
    scoreSubmission: vi.fn().mockReturnValue({ points: 20, isCorrect: true }),
  };
  const rules: GameRuleRegistryPort = {
    get: vi.fn().mockReturnValue(overrides.ruleAvailable === false ? undefined : rule),
    register: vi.fn(),
  };
  const scoring = {
    score: vi.fn(() => ({ points: 20, isCorrect: true })),
  };
  const rateLimiter = {
    consume: vi.fn().mockResolvedValue({ allowed: overrides.rateLimitAllowed ?? true }),
  };
  const eventAccess = { isEventOpen: vi.fn().mockResolvedValue(true) };
  const service = new GameActionService(
    store as never,
    transactions as never,
    rules,
    scoring as never,
    () => overrides.clock ?? now,
    overrides.rateLimiterAvailable === false ? undefined : rateLimiter as never,
    eventAccess as never,
  );
  return { service, store, transactions, transaction, rule, rules, scoring, rateLimiter, eventAccess };
}

describe('GameActionService', () => {
  it('checks active grant, current round, and server deadline before recording a server-scored action', async () => {
    const { service, store, rule, scoring, transaction, rateLimiter } = setup();

    await expect(service.submitAction(sessionId, credential, action)).resolves.toEqual({
      sessionId,
      game: { title: 'Live Trivia', kind: 'live-trivia' },
      status: 'live',
      startedAt: '2026-10-16T11:59:00.000Z',
      currentRound: { key: 'round-1', number: 1, total: 3 },
      currentPrompt: 'Question?',
      participant: {
        participantAlias: expect.stringMatching(/^Guest [A-F0-9]{10}$/),
        hasSubmitted: true,
        score: 20,
      },
      aggregateResults: [],
    });
    expect(store.findParticipantActionContext).toHaveBeenCalledWith({
      sessionId,
      tokenDigest: createHash('sha256').update(credential).digest('hex'),
    }, transaction);
    expect(rule.getCurrentRound).toHaveBeenCalledWith(expect.objectContaining({
      configuration: { rounds: [{ key: 'round-1', prompt: 'Question?' }] },
      startedAt: new Date('2026-10-16T11:59:00.000Z'),
      now,
    }));
    expect(rule.validateSubmission).toHaveBeenCalledWith({
      configuration: { rounds: [{ key: 'round-1', prompt: 'Question?' }] },
      currentRound: {
        key: 'round-1', number: 1, total: 3, prompt: 'Question?',
        deadlineAt: new Date(now.getTime() + 1_000),
      },
      action,
    });
    expect(scoring.score).toHaveBeenCalledWith(expect.objectContaining({ action }));
    expect(store.recordParticipantAction).toHaveBeenCalledWith({
      eventId: 'event-1',
      sessionId,
      participationGrantId: 'grant-1',
      tokenDigest: createHash('sha256').update(credential).digest('hex'),
      roundKey: 'round-1',
      roundNumber: 1,
      actionKind: 'answer',
      payload: { answer: 'A' },
      points: 20,
      isCorrect: true,
      deadlineAt: new Date(now.getTime() + 1_000),
      createdAt: now,
    }, transaction);
    expect(rateLimiter.consume).toHaveBeenCalledWith({
      eventId: 'event-1', action: 'submit_answer', participantTokenId: 'grant-1',
    });
  });

  it('rate-limits votes against the event-scoped participant grant before recording', async () => {
    const vote: PrismSubmitEventGameActionInput = {
      templateId: 'this-or-that', roundKey: 'round-1', actionKind: 'vote', payload: { option: 'Tea' },
    };
    const { service, rateLimiter, store } = setup();

    await service.submitAction(sessionId, credential, vote);

    expect(rateLimiter.consume).toHaveBeenCalledWith({
      eventId: 'event-1', action: 'submit_vote', participantTokenId: 'grant-1',
    });
    expect(store.recordParticipantAction).toHaveBeenCalledOnce();
  });

  it('rejects an action when the persistent limiter denies its participant bucket', async () => {
    const { service, rateLimiter, store } = setup({ rateLimitAllowed: false });

    await expect(service.submitAction(sessionId, credential, action)).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });

    expect(rateLimiter.consume).toHaveBeenCalledOnce();
    expect(store.recordParticipantAction).not.toHaveBeenCalled();
  });

  it('fails closed when submission rate limiting is unavailable', async () => {
    const { service, store } = setup({ rateLimiterAvailable: false });

    await expect(service.submitAction(sessionId, credential, action)).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(store.recordParticipantAction).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong round', { key: 'round-2', number: 2, total: 3, prompt: 'Next?', deadlineAt: null }, now],
    ['closed deadline', { key: 'round-1', number: 1, total: 3, prompt: 'Question?', deadlineAt: new Date(now.getTime() - 1) }, now],
  ])('rejects a %s without persisting an action', async (_label, currentRound, clock) => {
    const { service, store } = setup({ currentRound, clock });

    await expect(service.submitAction(sessionId, credential, action)).rejects.toBeInstanceOf(ConflictException);
    expect(store.recordParticipantAction).not.toHaveBeenCalled();
  });

  it('rejects a session that is not live or an active participant grant', async () => {
    for (const status of ['lobby', 'paused', 'completed', 'cancelled']) {
      const { service, store } = setup({ context: {
        eventId: 'event-1', sessionId, title: 'Live Trivia', kind: 'live-trivia', status,
        configSnapshot: {}, startedAt: new Date(), participationGrantId: 'grant-1',
      } });
      await expect(service.submitAction(sessionId, credential, action)).rejects.toBeInstanceOf(ConflictException);
      expect(store.recordParticipantAction).not.toHaveBeenCalled();
    }
    const missingGrant = setup({ context: null });
    await expect(missingGrant.service.submitAction(sessionId, credential, action)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fails closed for an unimplemented game rule or invalid mode-specific submission', async () => {
    const unsupported = setup({ ruleAvailable: false });
    await expect(unsupported.service.submitAction(sessionId, credential, action)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(unsupported.store.recordParticipantAction).not.toHaveBeenCalled();

    const invalid = setup({ validationErrors: ['incorrect round response shape'] });
    await expect(invalid.service.submitAction(sessionId, credential, action)).rejects.toBeInstanceOf(ConflictException);
    expect(invalid.store.recordParticipantAction).not.toHaveBeenCalled();
  });

  it('does not turn a duplicate or concurrently revoked action into a second score', async () => {
    const duplicate = setup({ stored: null });

    await expect(duplicate.service.submitAction(sessionId, credential, action)).rejects.toBeInstanceOf(ConflictException);
    expect(duplicate.store.recordParticipantAction).toHaveBeenCalledOnce();
  });

  it('rejects participant actions after event closure in the write transaction', async () => {
    const { service, store, eventAccess } = setup();
    eventAccess.isEventOpen.mockResolvedValue(false);

    await expect(service.submitAction(sessionId, credential, action)).rejects.toBeInstanceOf(ConflictException);
    expect(store.recordParticipantAction).not.toHaveBeenCalled();
  });

  it('rejects malformed credentials before reading participant state', async () => {
    const { service, store } = setup();

    await expect(service.submitAction(sessionId, 'bad', action)).rejects.toBeInstanceOf(NotFoundException);
    expect(store.findParticipantActionContext).not.toHaveBeenCalled();
  });
});
