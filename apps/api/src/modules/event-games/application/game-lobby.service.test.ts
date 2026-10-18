import { ConflictException, ForbiddenException, HttpException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { EventGamesLobbyService } from './game-lobby.service';

const eventId = 'event-1';
const gameId = 'game-1';
const lobbySlug = 'opaque-lobby-slug';

function setup(overrides: { event?: Record<string, unknown> | null; games?: Array<Record<string, unknown>>; game?: Record<string, unknown> | null; branding?: Record<string, unknown> | null; ruleAvailable?: boolean; rateLimiterAvailable?: boolean; rateLimitAllowed?: boolean; configSecret?: string; production?: boolean } = {}) {
  const transaction = { prisma: {}, correlationId: 'lobby-test', actorId: 'public-participant' } as PrismTransactionContext;
  const transactions = { run: vi.fn(async (work: (tx: PrismTransactionContext) => Promise<unknown>) => work(transaction)) };
  const access = {
    getPublicEventScope: vi.fn().mockResolvedValue(overrides.event === undefined ? { eventId, eventName: 'Launch', archived: false, closed: false } : overrides.event),
    assertHostAccess: vi.fn(),
    isEventOpen: vi.fn().mockResolvedValue(true),
  };
  const game = overrides.game === undefined ? {
    id: gameId, eventId, title: 'Word Scramble', kind: 'word-scramble', entryMode: 'independent',
    status: 'published', config: { answerKey: 'SECRET' }, availableFrom: null, availableUntil: null,
  } : overrides.game;
  const store = {
    ensureLobbySlug: vi.fn().mockResolvedValue(lobbySlug),
    findEventIdForLobbySlug: vi.fn().mockResolvedValue(eventId),
    findLobbyBranding: vi.fn().mockResolvedValue(overrides.branding === undefined ? {
      theme: 'prism', primaryColor: null, secondaryColor: null, logoObjectId: null,
    } : overrides.branding),
    findExistingIndependentStart: vi.fn().mockResolvedValue(null),
    listPublicIndependentGames: vi.fn().mockResolvedValue(overrides.games ?? [{
      id: gameId, title: 'Word Scramble', kind: 'word-scramble', status: 'published', entryMode: 'independent',
      availableFrom: null, availableUntil: null, config: { answerKey: 'SECRET' },
    }]),
    findPublishedIndependentGame: vi.fn().mockResolvedValue(game),
    createIndependentSessionAndGrant: vi.fn().mockResolvedValue({
      sessionId: 'session-1', eventId, gameId, status: 'live',
      title: 'Word Scramble', kind: 'word-scramble',
    }),
  };
  const rule = { validateConfiguration: vi.fn().mockReturnValue([]) };
  const rules = overrides.ruleAvailable === false ? undefined : { get: vi.fn().mockReturnValue(rule) };
  const rateLimiter = overrides.rateLimiterAvailable === false ? undefined : {
    consume: vi.fn().mockResolvedValue({ allowed: overrides.rateLimitAllowed ?? true, retryAfterSeconds: 30 }),
  };
  const config = { get: vi.fn((key: string) => {
    if (key === 'PRISM_SESSION_SECRET') return overrides.configSecret ?? 'test-session-secret-for-event-games-123456';
    if (key === 'NODE_ENV') return overrides.production ? 'production' : 'test';
    return undefined;
  }) };
  const hostCommands = { executeHostCommand: vi.fn(async (input: { command: { lobbySlug?: string; theme?: string } }) => ({ resultId: input.command.lobbySlug ?? input.command.theme })) };
  const mediaStorage = {
    validateLobbyLogoReference: vi.fn().mockResolvedValue(undefined),
    issueLobbyLogoDownloadAuthorization: vi.fn().mockResolvedValue({ downloadUrl: 'https://storage.example.test/lobby-logo', expiresAt: '2026-10-16T00:05:00.000Z' }),
    requestLobbyLogoUpload: vi.fn().mockResolvedValue({ objectId: 'obj_00000000-0000-4000-8000-000000000107', uploadUrl: 'https://storage.example.test/upload', expiresAt: '2026-10-16T00:05:00.000Z', alreadyStored: false }),
    confirmLobbyLogoUpload: vi.fn().mockResolvedValue({ objectId: 'obj_00000000-0000-4000-8000-000000000107' }),
  };
  const service = new EventGamesLobbyService(access as never, store as never, rules as never, transactions as never, () => new Date('2026-10-16T00:00:00.000Z'), rateLimiter as never, config as never, hostCommands as never, mediaStorage as never);
  return { service, access, store, rule, rateLimiter, config, hostCommands, mediaStorage, transaction, transactions };
}

describe('EventGamesLobbyService', () => {
  it('returns only published Independent game summaries for an open event, never host configuration', async () => {
    const { service, store, access, rateLimiter, transaction } = setup({ games: [
      { id: gameId, title: 'Word Scramble', kind: 'word-scramble', status: 'published', entryMode: 'independent', availableFrom: null, availableUntil: null, config: { answerKey: 'SECRET' } },
      { id: 'future-game', title: 'Future', kind: 'word-scramble', status: 'published', entryMode: 'independent', availableFrom: new Date('2026-10-16T00:00:01.000Z'), availableUntil: null },
      { id: 'expired-game', title: 'Expired', kind: 'word-scramble', status: 'published', entryMode: 'independent', availableFrom: null, availableUntil: new Date('2026-10-16T00:00:00.000Z') },
      { id: 'draft-game', title: 'Draft', kind: 'bingo', status: 'draft', entryMode: 'independent', availableFrom: null, availableUntil: null },
      { id: 'multiplayer', title: 'Trivia', kind: 'live-trivia', status: 'published', entryMode: 'active', availableFrom: null, availableUntil: null },
    ] });

    const result = await service.getPublicLobby(lobbySlug, '203.0.113.10');

    expect(store.findEventIdForLobbySlug).toHaveBeenCalledWith(lobbySlug, transaction);
    expect(access.getPublicEventScope).toHaveBeenCalledWith(eventId, transaction);
    expect(rateLimiter?.consume).toHaveBeenCalledWith(expect.objectContaining({ action: 'lobby_read', globalBudgetKey: 'event-game:public-lobby-read' }));
    expect(result).toEqual({
      eventId,
      eventSlug: lobbySlug, eventName: 'Launch',
      branding: { theme: 'prism', primaryColor: '#312E81', secondaryColor: '#0F766E', logoUrl: null },
      games: [{ id: gameId, title: 'Word Scramble', kind: 'word-scramble', availableFrom: null, availableUntil: null }],
    });
    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(JSON.stringify(result)).not.toContain('config');
  });

  it('denies missing or archived event lobbies', async () => {
    const missing = setup({ event: null });
    await expect(missing.service.getPublicLobby(lobbySlug, '203.0.113.10')).rejects.toBeInstanceOf(NotFoundException);
    const archived = setup({ event: { eventId, eventName: 'Launch', archived: true } });
    await expect(archived.service.getPublicLobby(lobbySlug, '203.0.113.10')).rejects.toBeInstanceOf(NotFoundException);
    const closed = setup({ event: { eventId, eventName: 'Launch', archived: false, closed: true } });
    await expect(closed.service.getPublicLobby(lobbySlug, '203.0.113.10')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fails closed or rate-limits public lobby reads before looking up a slug', async () => {
    const missingLimiter = setup({ rateLimiterAvailable: false });
    await expect(missingLimiter.service.getPublicLobby(lobbySlug, '203.0.113.10')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(missingLimiter.store.findEventIdForLobbySlug).not.toHaveBeenCalled();

    const denied = setup({ rateLimitAllowed: false });
    let rejected: unknown;
    try {
      await denied.service.getPublicLobby(lobbySlug, '203.0.113.10');
    } catch (error) {
      rejected = error;
    }
    expect(rejected).toBeInstanceOf(HttpException);
    expect((rejected as HttpException).getStatus()).toBe(429);
    expect(denied.store.findEventIdForLobbySlug).not.toHaveBeenCalled();
  });

  it('applies an event-scoped lobby-read budget after the coarse lookup budget', async () => {
    const { service, store, access, rateLimiter } = setup();
    rateLimiter?.consume
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 45 });

    await expect(service.getPublicLobby(lobbySlug, '203.0.113.10')).rejects.toMatchObject({ status: 429 });

    expect(rateLimiter?.consume).toHaveBeenCalledTimes(2);
    expect(rateLimiter?.consume.mock.calls[0]?.[0]).toMatchObject({
      action: 'lobby_read', globalBudgetKey: 'event-game:public-lobby-read',
    });
    expect(rateLimiter?.consume.mock.calls[1]?.[0]).toMatchObject({
      action: 'lobby_read', eventId, globalBudgetKey: `event:${eventId}:lobby-read`,
    });
    expect(store.findEventIdForLobbySlug).toHaveBeenCalledOnce();
    expect(access.getPublicEventScope).not.toHaveBeenCalled();
  });

  it('consumes event-scoped limiter budgets outside the event read/start transactions', async () => {
    const { service, transactions, transaction, rateLimiter } = setup();
    let transactionDepth = 0;
    transactions.run.mockImplementation(async (work) => {
      transactionDepth += 1;
      try {
        return await work(transaction);
      } finally {
        transactionDepth -= 1;
      }
    });
    rateLimiter?.consume.mockImplementation(async () => {
      if (transactionDepth > 0) throw new Error('rate-limit transaction nested inside event transaction');
      return { allowed: true };
    });

    await service.getPublicLobby(lobbySlug, '203.0.113.10');
    await service.startIndependentGame(lobbySlug, gameId, {
      idempotencyKey: '00000000-0000-4000-8000-000000000013',
    }, '203.0.113.10');

    expect(rateLimiter?.consume).toHaveBeenCalledTimes(4);
  });

  it('provisions a deterministic opaque lobby slug through the audited host command path', async () => {
    const { service, access, hostCommands } = setup();
    const host = { actorId: 'host-1', actorRole: 'pmcm-admin' } as never;

    const result = await service.ensureLobbySlug(eventId, host);

    expect(result.eventSlug).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hostCommands.executeHostCommand).toHaveBeenCalledWith(expect.objectContaining({
      eventId,
      actor: host,
      resourceType: 'lobby',
      resourceId: eventId,
      action: 'provision_lobby',
      command: { lobbySlug: result.eventSlug },
      requestReceiptId: expect.stringContaining(eventId),
    }));
    expect(access.assertHostAccess).toHaveBeenCalledWith(eventId, host);
  });

  it('updates accessible colors and a validated logo reference through the audited host command', async () => {
    const { service, access, hostCommands, mediaStorage, store } = setup();
    const host = { actorId: 'host-1', actorRole: 'pmcm-admin' } as never;
    const idempotencyKey = '00000000-0000-4000-8000-000000000101';
    const logoObjectId = 'obj_00000000-0000-4000-8000-000000000107';
    store.findLobbyBranding
      .mockResolvedValueOnce({ theme: 'prism', primaryColor: null, secondaryColor: null, logoObjectId: null })
      .mockResolvedValueOnce({ theme: 'forest', primaryColor: '#14532D', secondaryColor: '#166534', logoObjectId });

    const result = await service.updateHostLobbyBranding(eventId, host, {
      theme: 'forest', primaryColor: '#14532D', secondaryColor: '#166534', logoObjectId, idempotencyKey,
    });

    expect(result).toEqual({ theme: 'forest', primaryColor: '#14532D', secondaryColor: '#166534', logoUrl: 'https://storage.example.test/lobby-logo', logoObjectId });
    expect(mediaStorage.validateLobbyLogoReference).toHaveBeenCalledWith({ eventId, objectId: logoObjectId });
    expect(access.assertHostAccess).toHaveBeenCalledWith(eventId, host);
    expect(hostCommands.executeHostCommand).toHaveBeenCalledWith(expect.objectContaining({
      eventId,
      actor: host,
      resourceType: 'lobby',
      resourceId: eventId,
      action: 'update_lobby_branding',
      command: { theme: 'forest', primaryColor: '#14532D', secondaryColor: '#166534', logoObjectId },
      requestReceiptId: `update-game-lobby-branding:${eventId}:${idempotencyKey}`,
    }));
  });

  it('requests and confirms a host-authorized event lobby logo upload', async () => {
    const { service, access, mediaStorage } = setup();
    const host = { actorId: 'host-1', actorRole: 'pmcm-admin' } as never;
    const request = {
      fileName: 'logo.png',
      contentType: 'image/png' as const,
      declaredByteSize: 3,
      checksumSha256: createHash('sha256').update('png').digest('hex'),
      idempotencyKey: '00000000-0000-4000-8000-000000000101',
    };

    const ticket = await service.requestLobbyLogoUpload(eventId, host, request);
    const confirmed = await service.confirmLobbyLogoUpload(
      eventId,
      ticket.objectId,
      host,
      { checksumSha256: request.checksumSha256, byteSize: request.declaredByteSize },
    );

    expect(ticket).toMatchObject({ uploadUrl: 'https://storage.example.test/upload', alreadyStored: false });
    expect(mediaStorage.requestLobbyLogoUpload).toHaveBeenCalledWith({ eventId, actor: host, request });
    expect(confirmed).toEqual({ objectId: ticket.objectId });
    expect(mediaStorage.confirmLobbyLogoUpload).toHaveBeenCalledWith({
      eventId,
      objectId: ticket.objectId,
      actor: host,
      confirmation: { checksumSha256: request.checksumSha256, byteSize: 3 },
    });
    expect(access.assertHostAccess).toHaveBeenCalledWith(eventId, host);
  });

  it('returns persisted host lobby branding and public palette without exposing host data', async () => {
    const { service, store, access, transactions, transaction } = setup({ branding: {
      theme: 'ocean', primaryColor: '#164E63', secondaryColor: '#1D4ED8', logoObjectId: null,
    } });

    const branding = await service.getHostLobbyBranding(eventId, { actorId: 'host-1', actorRole: 'pmcm-admin' } as never);

    expect(branding).toEqual({ theme: 'ocean', primaryColor: '#164E63', secondaryColor: '#1D4ED8', logoUrl: null, logoObjectId: null });
    expect(access.assertHostAccess).toHaveBeenCalledOnce();
    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), { actorId: 'host-1' });
    expect(store.findLobbyBranding).toHaveBeenCalledWith(eventId, transaction);
  });

  it('returns an event-signed logo to public lobby clients without the stored object ID', async () => {
    const logoObjectId = 'obj_00000000-0000-4000-8000-000000000107';
    const { service, mediaStorage } = setup({ branding: {
      theme: 'forest', primaryColor: '#14532D', secondaryColor: '#166534', logoObjectId,
    } });

    const result = await service.getPublicLobby(lobbySlug, '203.0.113.10');

    expect(result.branding).toEqual({
      theme: 'forest', primaryColor: '#14532D', secondaryColor: '#166534',
      logoUrl: 'https://storage.example.test/lobby-logo',
    });
    expect(result.branding).not.toHaveProperty('logoObjectId');
    expect(mediaStorage.issueLobbyLogoDownloadAuthorization).toHaveBeenCalledWith(
      { eventId, objectId: logoObjectId }, expect.anything(),
    );
  });

  it('starts a published Independent game only inside its configured window and creates a scoped grant', async () => {
    const { service, store, rule, rateLimiter } = setup({ game: {
      id: gameId, eventId, title: 'Word Scramble', kind: 'word-scramble', entryMode: 'independent', status: 'published',
      configVersionId: 'config-1', config: { prompt: 'Scramble' },
      availableFrom: new Date('2026-10-15T00:00:00.000Z'), availableUntil: new Date('2026-10-17T00:00:00.000Z'),
    } });

    const result = await service.startIndependentGame(lobbySlug, gameId, {
      idempotencyKey: '00000000-0000-4000-8000-000000000004',
    }, '203.0.113.10');

    expect(result).toEqual({
      eventId,
      sessionId: 'session-1', game: { title: 'Word Scramble', kind: 'word-scramble' },
      status: 'live', participantCredential: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    expect(rule.validateConfiguration).toHaveBeenCalledWith({ prompt: 'Scramble' });
    expect(rateLimiter?.consume).toHaveBeenCalledTimes(2);
    expect(rateLimiter?.consume).toHaveBeenCalledWith(expect.objectContaining({
      eventId, action: 'lobby_start', sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      globalBudgetKey: `event:${eventId}:lobby-start`,
    }));
    expect(rateLimiter?.consume.mock.calls[0]?.[0]).toMatchObject({
      action: 'lobby_start', sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      globalBudgetKey: 'event-game:public-lobby-start',
    });
    expect(rateLimiter?.consume.mock.calls[1]?.[0]).toMatchObject({
      eventId, action: 'lobby_start', sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      globalBudgetKey: `event:${eventId}:lobby-start`,
    });
    const rateLimitRequest = rateLimiter?.consume.mock.calls[1]?.[0];
    expect(rateLimitRequest?.sourceFingerprint).not.toBe(store.createIndependentSessionAndGrant.mock.calls[0]?.[0]?.tokenDigest);
    expect(store.createIndependentSessionAndGrant).toHaveBeenCalledWith(expect.objectContaining({
      eventId, gameId, idempotencyKey: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      tokenDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    }), expect.any(Object));
    expect(store.createIndependentSessionAndGrant.mock.calls[0]?.[0]?.idempotencyKey)
      .not.toBe('00000000-0000-4000-8000-000000000004');
    expect(JSON.stringify(store.createIndependentSessionAndGrant.mock.calls[0]?.[0])).not.toContain(result.participantCredential);
    expect(JSON.stringify(result)).not.toContain('prompt');
  });

  it('uses a half-open availability window and refuses host-disabled games', async () => {
    const startsAtBoundary = setup({ game: {
      id: gameId, eventId, title: 'Word Scramble', kind: 'word-scramble', entryMode: 'independent', status: 'published',
      configVersionId: 'config-1', config: { answerKey: 'SECRET' },
      availableFrom: new Date('2026-10-16T00:00:00.000Z'), availableUntil: new Date('2026-10-17T00:00:00.000Z'),
    } });
    await expect(startsAtBoundary.service.startIndependentGame(lobbySlug, gameId, {
      idempotencyKey: '00000000-0000-4000-8000-000000000020',
    }, '203.0.113.10')).resolves.toMatchObject({ status: 'live' });

    const endsAtBoundary = setup({ game: {
      id: gameId, eventId, title: 'Word Scramble', kind: 'word-scramble', entryMode: 'independent', status: 'published',
      configVersionId: 'config-1', config: { answerKey: 'SECRET' },
      availableFrom: null, availableUntil: new Date('2026-10-16T00:00:00.000Z'),
    } });
    await expect(endsAtBoundary.service.startIndependentGame(lobbySlug, gameId, {
      idempotencyKey: '00000000-0000-4000-8000-000000000021',
    }, '203.0.113.10')).rejects.toBeInstanceOf(ForbiddenException);
    expect(endsAtBoundary.store.createIndependentSessionAndGrant).not.toHaveBeenCalled();

    for (const disabledGame of [
      { id: gameId, eventId, title: 'Word Scramble', kind: 'word-scramble', entryMode: 'independent', status: 'draft', config: {} },
      { id: gameId, eventId, title: 'Word Scramble', kind: 'word-scramble', entryMode: 'independent', status: 'published', archivedAt: new Date(), config: {} },
    ]) {
      const disabled = setup({ game: disabledGame });
      await expect(disabled.service.startIndependentGame(lobbySlug, gameId, {
        idempotencyKey: '00000000-0000-4000-8000-000000000022',
      }, '203.0.113.10')).rejects.toBeInstanceOf(NotFoundException);
      expect(disabled.store.createIndependentSessionAndGrant).not.toHaveBeenCalled();
    }
  });

  it('reuses a supplied server-issued credential only by its stored digest', async () => {
    const { service, store } = setup();
    const participantCredential = 'A'.repeat(43);

    const result = await service.startIndependentGame(lobbySlug, gameId, {
      idempotencyKey: '00000000-0000-4000-8000-000000000004',
      participantCredential,
    }, '203.0.113.10');

    expect(result.participantCredential).toBe(participantCredential);
    expect(store.createIndependentSessionAndGrant).toHaveBeenCalledWith(expect.objectContaining({
      tokenDigest: createHash('sha256').update(participantCredential).digest('hex'),
      createCredential: false,
    }), expect.any(Object));
  });

  it('replays an idempotent start before publication and availability-window checks', async () => {
    const unavailableVersions = [
      null,
      {
        id: gameId, eventId, title: 'Word Scramble', kind: 'word-scramble', entryMode: 'independent', status: 'published',
        availableFrom: new Date('2026-10-17T00:00:00.000Z'), availableUntil: null,
      },
      {
        id: gameId, eventId, title: 'Word Scramble', kind: 'word-scramble', entryMode: 'independent', status: 'published',
        availableFrom: null, availableUntil: new Date('2026-10-16T00:00:00.000Z'),
      },
    ];

    for (const unavailableGame of unavailableVersions) {
      const { service, store } = setup();
      const input = { idempotencyKey: '00000000-0000-4000-8000-000000000004' };
      const first = await service.startIndependentGame(lobbySlug, gameId, input, '203.0.113.10');
      const persistedInput = store.createIndependentSessionAndGrant.mock.calls[0]?.[0];
      store.findExistingIndependentStart.mockResolvedValueOnce({
        eventId,
        gameId,
        sessionId: 'session-1',
        title: 'Word Scramble',
        kind: 'word-scramble',
        status: 'live',
        tokenDigest: persistedInput?.tokenDigest,
      });
      store.findPublishedIndependentGame.mockResolvedValueOnce(unavailableGame);

      const retry = await service.startIndependentGame(lobbySlug, gameId, input, '203.0.113.10');

      expect(retry).toEqual(first);
      expect(store.findPublishedIndependentGame).toHaveBeenCalledTimes(1);
      expect(store.createIndependentSessionAndGrant).toHaveBeenCalledTimes(1);
    }
  });

  it('rejects idempotent replay after its retained participant credential is revoked', async () => {
    const { service, store } = setup();
    await service.startIndependentGame(lobbySlug, gameId, {
      idempotencyKey: '00000000-0000-4000-8000-000000000013',
    }, '203.0.113.10');
    store.findExistingIndependentStart.mockResolvedValueOnce({
      eventId, gameId, sessionId: 'session-1', title: 'Word Scramble', kind: 'word-scramble',
      status: 'live', tokenDigest: null,
    });

    await expect(service.startIndependentGame(lobbySlug, gameId, {
      idempotencyKey: '00000000-0000-4000-8000-000000000013',
    }, '203.0.113.10')).rejects.toBeInstanceOf(ForbiddenException);
    expect(store.createIndependentSessionAndGrant).toHaveBeenCalledOnce();
  });

  it('rejects an idempotency key reused with a different game or participant credential', async () => {
    const { service, store } = setup();
    const input = { idempotencyKey: '00000000-0000-4000-8000-000000000004' };
    const first = await service.startIndependentGame(lobbySlug, gameId, input, '203.0.113.10');
    const persistedInput = store.createIndependentSessionAndGrant.mock.calls[0]?.[0];
    const existing = {
      eventId, gameId, sessionId: 'session-1', title: 'Word Scramble', kind: 'word-scramble' as const,
      status: 'live' as const, tokenDigest: persistedInput?.tokenDigest,
    };
    store.findExistingIndependentStart.mockResolvedValueOnce(existing);
    await expect(service.startIndependentGame(lobbySlug, 'other-game', input, '203.0.113.10'))
      .rejects.toBeInstanceOf(ConflictException);

    store.findExistingIndependentStart.mockResolvedValueOnce(existing);
    await expect(service.startIndependentGame(lobbySlug, gameId, {
      ...input,
      participantCredential: 'B'.repeat(43),
    }, '203.0.113.10')).rejects.toBeInstanceOf(ConflictException);
    expect(first.participantCredential).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('derives distinct rate-limit fingerprints from the trusted request source', async () => {
    const first = setup();
    const second = setup();
    await first.service.getPublicLobby(lobbySlug, '203.0.113.10');
    await second.service.getPublicLobby(lobbySlug, '203.0.113.11');

    const firstFingerprint = first.rateLimiter?.consume.mock.calls[0]?.[0]?.sourceFingerprint;
    const secondFingerprint = second.rateLimiter?.consume.mock.calls[0]?.[0]?.sourceFingerprint;
    expect(firstFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(secondFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(firstFingerprint).not.toBe(secondFingerprint);
    expect(firstFingerprint).not.toContain('203.0.113.10');
  });

  it('rejects cross-event slugs and closed or out-of-window game starts without creating a session', async () => {
    const crossEvent = setup();
    crossEvent.store.findEventIdForLobbySlug.mockResolvedValue('event-2');
    await expect(crossEvent.service.startIndependentGame(lobbySlug, gameId, { idempotencyKey: '00000000-0000-4000-8000-000000000005' }, '203.0.113.10'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(crossEvent.store.createIndependentSessionAndGrant).not.toHaveBeenCalled();

    const outOfWindow = setup({ game: {
      id: gameId, eventId, title: 'Word Scramble', kind: 'word-scramble', entryMode: 'independent', status: 'published',
      configVersionId: 'config-1', config: {}, availableFrom: new Date('2026-10-17T00:00:00.000Z'), availableUntil: null,
    } });
    await expect(outOfWindow.service.startIndependentGame(lobbySlug, gameId, { idempotencyKey: '00000000-0000-4000-8000-000000000006' }, '203.0.113.10'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(outOfWindow.store.createIndependentSessionAndGrant).not.toHaveBeenCalled();
  });

  it('does not create an independent session if closure races the public lobby read', async () => {
    const { service, access, store } = setup();
    access.isEventOpen.mockResolvedValue(false);

    await expect(service.startIndependentGame(lobbySlug, gameId, {
      idempotencyKey: '00000000-0000-4000-8000-000000000021',
    }, '203.0.113.10')).rejects.toBeInstanceOf(NotFoundException);
    expect(store.createIndependentSessionAndGrant).not.toHaveBeenCalled();
  });

  it('issues different event-bound credentials for separate events', async () => {
    const eventA = setup();
    const eventAStart = await eventA.service.startIndependentGame(lobbySlug, gameId, { idempotencyKey: '00000000-0000-4000-8000-000000000007' }, '203.0.113.10');
    const eventB = setup({
      event: { eventId: 'event-2', eventName: 'Second Event', archived: false, closed: false },
      game: {
        id: gameId, eventId: 'event-2', title: 'Word Scramble', kind: 'word-scramble', entryMode: 'independent', status: 'published',
        configVersionId: 'config-2', config: {}, availableFrom: null, availableUntil: null,
      },
    });
    eventB.store.findEventIdForLobbySlug.mockResolvedValue('event-2');
    const eventBStart = await eventB.service.startIndependentGame(lobbySlug, gameId, { idempotencyKey: '00000000-0000-4000-8000-000000000007' }, '203.0.113.10');

    expect(eventAStart.participantCredential).not.toBe(eventBStart.participantCredential);
    expect(eventA.store.createIndependentSessionAndGrant.mock.calls[0]?.[0]?.tokenDigest)
      .not.toBe(eventB.store.createIndependentSessionAndGrant.mock.calls[0]?.[0]?.tokenDigest);
  });

  it('fails closed when production game rules are not registered', async () => {
    const { service, store } = setup({ ruleAvailable: false });
    await expect(service.startIndependentGame(lobbySlug, gameId, { idempotencyKey: '00000000-0000-4000-8000-000000000008' }, '203.0.113.10'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(store.createIndependentSessionAndGrant).not.toHaveBeenCalled();
  });

  it('fails closed when production lobby rate limiting is not registered', async () => {
    const { service, store } = setup({ rateLimiterAvailable: false });
    await expect(service.startIndependentGame(lobbySlug, gameId, { idempotencyKey: '00000000-0000-4000-8000-000000000009' }, '203.0.113.10'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(store.createIndependentSessionAndGrant).not.toHaveBeenCalled();
  });

  it('fails closed when production credential signing secret is missing', async () => {
    const { service, store } = setup({ configSecret: '', production: true });
    await expect(service.startIndependentGame(lobbySlug, gameId, { idempotencyKey: '00000000-0000-4000-8000-000000000010' }, '203.0.113.10'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(store.createIndependentSessionAndGrant).not.toHaveBeenCalled();
  });

  it('rejects a rate-limited anonymous start without creating a session or grant', async () => {
    const { service, store, rateLimiter } = setup({ rateLimitAllowed: false });
    let rejected: unknown;
    try {
      await service.startIndependentGame(lobbySlug, gameId, { idempotencyKey: '00000000-0000-4000-8000-000000000011' }, '203.0.113.10');
    } catch (error) {
      rejected = error;
    }
    expect(rejected).toBeInstanceOf(HttpException);
    expect((rejected as HttpException).getStatus()).toBe(429);
    expect(rateLimiter?.consume).toHaveBeenCalledTimes(1);
    expect(store.createIndependentSessionAndGrant).not.toHaveBeenCalled();
  });

  it('applies the event start budget after the global source budget', async () => {
    const { service, store, access, rateLimiter } = setup();
    rateLimiter?.consume
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 45 });

    await expect(service.startIndependentGame(lobbySlug, gameId, {
      idempotencyKey: '00000000-0000-4000-8000-000000000012',
    }, '203.0.113.10')).rejects.toMatchObject({ status: 429 });

    expect(rateLimiter?.consume).toHaveBeenCalledTimes(2);
    expect(rateLimiter?.consume.mock.calls[0]?.[0]).toMatchObject({
      action: 'lobby_start', sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      globalBudgetKey: 'event-game:public-lobby-start',
    });
    expect(rateLimiter?.consume.mock.calls[1]?.[0]).toMatchObject({
      eventId, action: 'lobby_start', sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      globalBudgetKey: `event:${eventId}:lobby-start`,
    });
    expect(store.findPublishedIndependentGame).not.toHaveBeenCalled();
    expect(access.getPublicEventScope).not.toHaveBeenCalled();
  });

  it('replays the same singleplayer session and participant grant for a retry, and rejects a different game on the same key', async () => {
    const { service, store } = setup({ game: {
      id: gameId, eventId, title: 'Word Scramble', kind: 'word-scramble', entryMode: 'independent', status: 'published',
      configVersionId: 'config-1', config: {}, availableFrom: null, availableUntil: null,
    } });
    const sessions = new Map<string, { gameId: string; digest: string; result: { sessionId: string; title: string; kind: 'word-scramble'; status: 'live' } }>();
    let sessionsCreated = 0;
    let grantsCreated = 0;
    store.createIndependentSessionAndGrant.mockImplementation(async (input: { eventId: string; gameId: string; idempotencyKey: string; tokenDigest: string }) => {
      const key = `${input.eventId}:${input.idempotencyKey}`;
      const existing = sessions.get(key);
      if (existing) {
        if (existing.gameId !== input.gameId || existing.digest !== input.tokenDigest) {
          throw new ConflictException('Idempotency key content mismatch');
        }
        return existing.result;
      }
      sessionsCreated += 1;
      grantsCreated += 1;
      const result = { sessionId: 'session-1', title: 'Word Scramble', kind: 'word-scramble' as const, status: 'live' as const };
      sessions.set(key, { gameId: input.gameId, digest: input.tokenDigest, result });
      return result;
    });

    const input = { idempotencyKey: '00000000-0000-4000-8000-000000000004' };
    const first = await service.startIndependentGame(lobbySlug, gameId, input, '203.0.113.10');
    const retry = await service.startIndependentGame(lobbySlug, gameId, input, '203.0.113.10');

    expect(retry).toEqual(first);
    expect(first.participantCredential).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sessionsCreated).toBe(1);
    expect(grantsCreated).toBe(1);
    expect(store.createIndependentSessionAndGrant).toHaveBeenCalledTimes(2);

    store.findPublishedIndependentGame.mockResolvedValue({
      id: 'game-2', eventId, title: 'Would You Rather', kind: 'would-you-rather', entryMode: 'independent',
      status: 'published', configVersionId: 'config-2', config: {}, availableFrom: null, availableUntil: null,
    });
    await expect(service.startIndependentGame(lobbySlug, 'game-2', input, '203.0.113.10')).rejects.toBeInstanceOf(ConflictException);
    expect(sessionsCreated).toBe(1);
    expect(grantsCreated).toBe(1);
  });
});
