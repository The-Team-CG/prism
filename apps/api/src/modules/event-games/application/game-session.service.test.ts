import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismCreateGameSessionInput, PrismGameHostCommandInput, PrismGameHostState, PrismVerifiedEventActor } from '@prism/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameSessionService } from './game-session.service';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T10:00:00.000Z'));
});

afterEach(() => vi.useRealTimers());

const eventId = 'event-1';
const gameId = '00000000-0000-4000-8000-000000000001';
const sessionId = '00000000-0000-4000-8000-000000000002';
const configVersionId = '00000000-0000-4000-8000-000000000003';

function actor(): PrismVerifiedEventActor {
  return {
    id: 'actor-1', actorId: 'actor-1', role: 'coordinator', actorRole: 'coordinator',
    email: 'coordinator@example.test', actorEmail: 'coordinator@example.test',
    name: 'Coordinator', actorName: 'Coordinator', expiresAt: '2030-01-01T00:00:00.000Z',
  };
}

function createService(overrides: {
  access?: { assertHostAccess: ReturnType<typeof vi.fn> };
  store?: Record<string, ReturnType<typeof vi.fn>>;
  rules?: { get: ReturnType<typeof vi.fn> };
  audit?: { recordHostWrite: ReturnType<typeof vi.fn> };
  hostCommands?: { executeHostCommand: ReturnType<typeof vi.fn> };
  scheduler?: { schedule: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> } | null;
  sessionPins?: { issueSessionPin: ReturnType<typeof vi.fn> };
  clock?: () => Date;
} = {}) {
  const transaction = { prisma: {}, correlationId: 'game-session-test', actorId: 'actor-1' } as PrismTransactionContext;
  const transactions = {
    run: vi.fn(async (work: (context: PrismTransactionContext) => Promise<unknown>) => work(transaction)),
  };
  const access = overrides.access ?? {
    assertHostAccess: vi.fn().mockResolvedValue(undefined),
    isEventOpen: vi.fn().mockResolvedValue(true),
  };
  const store = overrides.store ?? {
    findPublishedDefinitionForSession: vi.fn().mockResolvedValue({
      id: gameId,
      eventId,
      title: 'Trivia',
      kind: 'live-trivia',
      entryMode: 'active',
      status: 'published',
      version: 4,
      configVersionId,
      config: { rounds: [{ prompt: 'Question', answer: 'secret' }] },
      availableFrom: null,
      availableUntil: null,
    }),
    createHostSession: vi.fn(async (input: Record<string, unknown>) => ({
      id: sessionId,
      eventId,
      gameId,
      configVersionId,
      configSnapshot: { rounds: [{ prompt: 'Question', answer: 'secret' }] },
      title: 'Trivia',
      kind: 'live-trivia',
      entryMode: 'active',
      status: 'scheduled',
      scheduledStartAt: input.scheduledStartAt,
      startedAt: null,
      endedAt: null,
    })),
    getHostState: vi.fn().mockResolvedValue({
      eventId, sessionId, game: { id: gameId, title: 'Trivia', kind: 'live-trivia' }, status: 'scheduled',
      scheduledStartAt: '2026-10-20T10:00:00.000Z', startedAt: null, endedAt: null,
      participantCount: 0, currentRound: null, leaderboard: [],
    } satisfies PrismGameHostState),
  };
  const rule = { validateConfiguration: vi.fn().mockReturnValue([]) };
  const rules = overrides.rules ?? { get: vi.fn().mockReturnValue(rule) };
  const audit = overrides.audit ?? { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
  const hostCommands = overrides.hostCommands ?? {
    executeHostCommand: vi.fn().mockResolvedValue({
      eventId,
      resourceType: 'session',
      resourceId: sessionId,
      action: 'start_session',
      outcome: 'started',
      resultId: sessionId,
      requestReceiptId: 'receipt-1',
      transition: { beforeStatus: 'scheduled', afterStatus: 'live', beforeVersion: null, afterVersion: null },
    }),
  };
  const scheduler = overrides.scheduler === null ? undefined : overrides.scheduler ?? {
    schedule: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
  const sessionPins = overrides.sessionPins;
  return {
    service: new GameSessionService(access as never, store as never, rules as never, audit as never, transactions as never, hostCommands as never, scheduler as never, sessionPins as never, overrides.clock),
    access, store, rules, rule, audit, transactions, transaction, hostCommands, scheduler, sessionPins,
  };
}

describe('GameSessionService', () => {
  it('creates a host session from the published immutable config version and audits it transactionally', async () => {
    const { service, access, store, audit, transaction, scheduler } = createService();
    const input: PrismCreateGameSessionInput = {
      gameId,
      scheduledStartAt: '2026-10-20T10:00:00.000Z',
    };

    const result = await service.createHostSession(eventId, actor(), input);

    expect(result).toMatchObject({ id: sessionId, eventId, gameId, configVersionId, status: 'scheduled' });
    expect(access.assertHostAccess).toHaveBeenCalledWith(eventId, expect.objectContaining({ actorId: 'actor-1' }));
    expect(store.findPublishedDefinitionForSession).toHaveBeenCalledWith({ eventId, gameId }, transaction);
    expect(store.createHostSession).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId, gameId, createdBy: 'actor-1', configVersionId,
        configSnapshot: { rounds: [{ prompt: 'Question', answer: 'secret' }] },
        entryMode: 'active', status: 'scheduled',
      }),
      transaction,
    );
    expect(scheduler!.schedule).toHaveBeenCalledWith(
      { eventId, sessionId, startsAt: new Date(input.scheduledStartAt!) },
      transaction,
    );
    expect(audit.recordHostWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId, action: 'schedule_session', resourceType: 'session', resourceId: sessionId,
        outcome: 'scheduled', transition: { beforeStatus: null, afterStatus: 'scheduled', beforeVersion: null, afterVersion: null },
      }),
      transaction,
    );
  });

  it('rejects a past scheduled start before opening a write transaction', async () => {
    const { service, transactions, store, scheduler } = createService();

    await expect(service.createHostSession(eventId, actor(), {
      gameId,
      scheduledStartAt: new Date(Date.now() - 1_000).toISOString(),
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(transactions.run).not.toHaveBeenCalled();
    expect(store.createHostSession).not.toHaveBeenCalled();
    expect(scheduler!.schedule).not.toHaveBeenCalled();
  });

  it('fails closed when no durable scheduler is configured', async () => {
    const { service, transactions, store } = createService({ scheduler: null });

    await expect(service.createHostSession(eventId, actor(), {
      gameId,
      scheduledStartAt: new Date(Date.now() + 60_000).toISOString(),
    })).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(transactions.run).not.toHaveBeenCalled();
    expect(store.createHostSession).not.toHaveBeenCalled();
  });

  it('does not create or audit a session when the game id belongs to another event', async () => {
    const store = {
      findPublishedDefinitionForSession: vi.fn().mockResolvedValue(null),
      createHostSession: vi.fn(),
    };
    const { service, store: actualStore, audit } = createService({ store });

    await expect(service.createHostSession(eventId, actor(), { gameId } as PrismCreateGameSessionInput))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(actualStore.createHostSession).not.toHaveBeenCalled();
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });

  it('routes a host command through the event-scoped audited command service', async () => {
    const { service, hostCommands } = createService();
    const input: PrismGameHostCommandInput = {
      command: 'start',
      idempotencyKey: '00000000-0000-4000-8000-000000000004',
    };

    const result = await service.executeHostCommand(eventId, sessionId, actor(), input);

    expect(result).toMatchObject({ resourceType: 'session', resourceId: sessionId, outcome: 'started' });
    expect(hostCommands.executeHostCommand).toHaveBeenCalledWith(expect.objectContaining({
      eventId,
      actor: expect.objectContaining({ actorId: 'actor-1' }),
      resourceType: 'session',
      resourceId: sessionId,
      action: 'start_session',
      command: { command: 'start', reason: undefined },
      requestReceiptId: input.idempotencyKey,
    }));
  });

  it('advances only the requested active round and persists the remaining server time', async () => {
    const now = new Date('2026-10-17T10:00:10.000Z');
    const currentRound = {
      key: 'round-1', number: 1, total: 2, prompt: 'Pick a side',
      deadlineAt: new Date('2026-10-17T10:00:30.000Z'),
    };
    const readContext = {
      kind: 'split-the-room', status: 'live', configSnapshot: { configuration: {} },
      startedAt: new Date('2026-10-17T10:00:00.000Z'), endedAt: null, pausedAt: null,
      totalPausedMs: 0, roundOffsetMs: 0,
    };
    const store = { getHostReadContext: vi.fn().mockResolvedValue(readContext) };
    const rules = { get: vi.fn().mockReturnValue({ getCurrentRound: vi.fn().mockReturnValue(currentRound) }) };
    const { service, hostCommands } = createService({ store, rules, clock: () => now });
    const input = {
      command: 'advance-round', roundKey: 'round-1',
      idempotencyKey: '00000000-0000-4000-8000-000000000004',
    } as unknown as PrismGameHostCommandInput;

    await service.executeHostCommand(eventId, sessionId, actor(), input);

    expect(store.getHostReadContext).toHaveBeenCalled();
    expect(hostCommands.executeHostCommand).toHaveBeenCalledWith(expect.objectContaining({
      action: 'advance_round',
      command: expect.objectContaining({
        expectedRoundKey: 'round-1', expectedRoundOffsetMs: 0, advanceByMs: 20_000,
      }),
    }));
  });

  it('routes enable-joins to the one-time PIN issuer instead of the generic host command', async () => {
    const sessionPins = { issueSessionPin: vi.fn().mockResolvedValue({ pin: '123456', expiresAt: '2026-10-17T12:00:00.000Z' }) };
    const { service, hostCommands } = createService({ sessionPins });
    const input: PrismGameHostCommandInput = {
      command: 'enable-joins',
      idempotencyKey: '00000000-0000-4000-8000-000000000004',
    };

    const result = await service.executeHostCommand(eventId, sessionId, actor(), input);

    expect(result).toMatchObject({ pin: '123456', expiresAt: '2026-10-17T12:00:00.000Z' });
    expect(sessionPins.issueSessionPin).toHaveBeenCalledWith(eventId, sessionId, expect.objectContaining({ actorId: 'actor-1' }), input);
    expect(hostCommands.executeHostCommand).not.toHaveBeenCalled();
  });

  it('lets only the host persist one server-selected Spin the Wheel result on a live session', async () => {
    const result = { kind: 'spin-wheel' as const, outcomeId: 'bonus', label: 'Bonus points', points: 25 };
    const readContext = {
      kind: 'spin-wheel', status: 'live', configSnapshot: { configuration: { kind: 'spin-wheel' } },
      startedAt: new Date('2026-10-17T10:00:00.000Z'), endedAt: null, pausedAt: null,
      totalPausedMs: 0, roundOffsetMs: 0, wheelResult: null,
    };
    const store = { getHostReadContext: vi.fn().mockResolvedValue(readContext) };
    const rule = {
      validateConfiguration: vi.fn().mockReturnValue([]),
      scoreSubmission: vi.fn().mockReturnValue({ points: 25, isCorrect: true, result }),
    };
    const rules = { get: vi.fn().mockReturnValue(rule) };
    const { service, hostCommands, access } = createService({ store, rules });

    await service.executeHostCommand(eventId, sessionId, actor(), {
      command: 'spin-wheel',
      idempotencyKey: '00000000-0000-4000-8000-000000000004',
    } as PrismGameHostCommandInput);

    expect(access.assertHostAccess).toHaveBeenCalledWith(eventId, expect.objectContaining({ actorId: 'actor-1' }));
    expect(rule.scoreSubmission).toHaveBeenCalledWith({
      configuration: readContext.configSnapshot,
      submission: {},
    });
    expect(hostCommands.executeHostCommand).toHaveBeenCalledWith(expect.objectContaining({
      action: 'spin_wheel',
      command: { command: 'spin-wheel', wheelResult: result },
      requestReceiptId: '00000000-0000-4000-8000-000000000004',
    }));
  });

  it('does not spin a wheel before the host starts its session', async () => {
    const store = { getHostReadContext: vi.fn().mockResolvedValue({
      kind: 'spin-wheel', status: 'lobby', configSnapshot: { configuration: {} },
      startedAt: null, endedAt: null, pausedAt: null, totalPausedMs: 0, roundOffsetMs: 0, wheelResult: null,
    }) };
    const rule = { validateConfiguration: vi.fn().mockReturnValue([]), scoreSubmission: vi.fn() };
    const { service, hostCommands } = createService({ store, rules: { get: vi.fn().mockReturnValue(rule) } });

    await expect(service.executeHostCommand(eventId, sessionId, actor(), {
      command: 'spin-wheel', idempotencyKey: '00000000-0000-4000-8000-000000000004',
    } as PrismGameHostCommandInput)).rejects.toBeInstanceOf(ConflictException);

    expect(rule.scoreSubmission).not.toHaveBeenCalled();
    expect(hostCommands.executeHostCommand).not.toHaveBeenCalled();
  });

  it('returns only the event-scoped host read model and does not expose private config', async () => {
    const { service, store, access, transaction } = createService();

    const result = await service.getHostState(eventId, sessionId, actor());

    expect(result).toMatchObject({ eventId, sessionId, participantCount: 0, leaderboard: [] });
    expect(access.assertHostAccess).toHaveBeenCalledWith(eventId, expect.objectContaining({ actorId: 'actor-1' }));
    expect(store.getHostState).toHaveBeenCalledWith({ eventId, sessionId }, transaction);
    expect(result).not.toHaveProperty('configSnapshot');
  });
});
