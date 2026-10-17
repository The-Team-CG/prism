import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismJoinActiveMultiplayerGameSessionInput } from '@prism/types';
import { describe, expect, it, vi } from 'vitest';
import { GameParticipantGrantPersistenceError } from '../contracts/game-pin-store.port';
import { EventGamesSessionJoinService } from './game-session-join.service';

const eventId = 'event-1';
const sessionId = 'session-1';
const pin = '042681';
const idempotencyKey = 'a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5';
const now = new Date('2026-10-16T12:00:00.000Z');

function setup(overrides: {
  session?: Record<string, unknown> | null;
  event?: Record<string, unknown> | null;
  credentialFound?: boolean;
  rateLimitAllowed?: boolean;
  pinFailureCheckAllowed?: boolean;
  rateLimiterAvailable?: boolean;
  sessionSecret?: string | null;
  jwtSecret?: string;
} = {}) {
  const transaction = { prisma: {}, correlationId: 'join-test', actorId: 'anonymous-game-participant' } as PrismTransactionContext;
  const transactions = { run: vi.fn(async (work: (tx: PrismTransactionContext) => Promise<unknown>) => work(transaction)) };
  const eventAccess = {
    getPublicEventScope: vi.fn().mockResolvedValue(overrides.event === undefined
      ? { eventId, eventName: 'Launch', archived: false, closed: false }
      : overrides.event),
    isEventOpen: vi.fn().mockResolvedValue(true),
  };
  const pinStore = {
    findJoinableSessionByPinDigest: vi.fn().mockResolvedValue(overrides.session === undefined ? {
      eventId, sessionId, gameId: 'game-1', title: 'Live Trivia', kind: 'live-trivia',
      entryMode: 'active', status: 'lobby', expiresAt: new Date('2026-10-16T13:00:00.000Z'),
    } : overrides.session),
    findActiveCredential: vi.fn().mockResolvedValue(overrides.credentialFound === false ? null : { id: 'credential-1' }),
    findJoinGrant: vi.fn().mockResolvedValue(null),
    createParticipantGrant: vi.fn().mockResolvedValue({ sessionId, title: 'Live Trivia', kind: 'live-trivia', status: 'lobby' }),
    revokeSessionPin: vi.fn().mockResolvedValue(true),
  };
  const rateLimiter = overrides.rateLimiterAvailable === false ? undefined : {
    consume: vi.fn(async (request: { action: string }) => ({
      allowed: request.action === 'failed_pin_attempt'
        ? true
        : request.action === 'pin_failure_check'
          ? overrides.pinFailureCheckAllowed ?? true
          : overrides.rateLimitAllowed ?? true,
      retryAfterSeconds: 30,
    })),
  };
  const config = { get: vi.fn((key: string) => {
    if (key === 'PRISM_SESSION_SECRET') return overrides.sessionSecret === undefined
      ? 'test-session-secret-for-event-games-123456'
      : overrides.sessionSecret ?? undefined;
    if (key === 'JWT_SECRET') return overrides.jwtSecret;
    if (key === 'NODE_ENV') return 'test';
    return undefined;
  }) };
  const service = new EventGamesSessionJoinService(
    eventAccess as never,
    pinStore as never,
    transactions as never,
    rateLimiter as never,
    config as never,
    () => now,
  );
  return { service, eventAccess, pinStore, transactions, rateLimiter, transaction };
}

function joinInput(value: Partial<PrismJoinActiveMultiplayerGameSessionInput> = {}): PrismJoinActiveMultiplayerGameSessionInput {
  return { idempotencyKey, pin, ...value };
}

describe('EventGamesSessionJoinService', () => {
  it('joins an open Active session and persists only digests plus an event-scoped grant', async () => {
    const { service, pinStore, rateLimiter, transaction } = setup();

    const result = await service.joinActiveMultiplayerSession(joinInput(), undefined, '203.0.113.10');

    expect(result).toEqual({
      eventId,
      sessionId,
      game: { title: 'Live Trivia', kind: 'live-trivia' },
      status: 'lobby',
      participantCredential: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    expect(pinStore.findJoinableSessionByPinDigest).toHaveBeenCalledWith(
      expect.objectContaining({ pinDigest: expect.stringMatching(/^[a-f0-9]{64}$/) }),
      transaction,
    );
    expect(pinStore.createParticipantGrant).toHaveBeenCalledWith(expect.objectContaining({
      eventId,
      sessionId,
      tokenDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      idempotencyKeyDigest: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      createCredential: true,
    }), transaction);
    const persisted = JSON.stringify(pinStore.createParticipantGrant.mock.calls[0]?.[0]);
    expect(persisted).not.toContain(pin);
    expect(persisted).not.toContain(result.participantCredential);
    expect(rateLimiter?.consume).toHaveBeenCalledWith(expect.objectContaining({
      action: 'pin_attempt',
      sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      globalBudgetKey: 'event-game:pin-join-attempts',
    }));
  });

  it('uses the same JWT secret fallback as host PIN issuance', async () => {
    const { service } = setup({ sessionSecret: null, jwtSecret: 'legacy-session-secret-for-event-games-123456' });

    const result = await service.joinActiveMultiplayerSession(joinInput(), undefined, '203.0.113.10');

    expect(result.sessionId).toBe(sessionId);
    expect(result.participantCredential).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('reuses an event-matched retained credential only after an active row lookup', async () => {
    const { service, pinStore } = setup();
    const retained = 'R'.repeat(43);

    const result = await service.joinActiveMultiplayerSession(joinInput(), retained, '203.0.113.10');

    expect(result.participantCredential).toBe(retained);
    expect(pinStore.findActiveCredential).toHaveBeenCalledWith({
      eventId,
      tokenDigest: createHash('sha256').update(retained).digest('hex'),
    }, expect.any(Object));
    expect(pinStore.createParticipantGrant).toHaveBeenCalledWith(expect.objectContaining({
      credentialId: 'credential-1',
      createCredential: false,
    }), expect.any(Object));
  });

  it('replays an identical join key without creating a second grant', async () => {
    const { service, pinStore } = setup();
    const first = await service.joinActiveMultiplayerSession(joinInput(), undefined, '203.0.113.10');
    const tokenDigest = createHash('sha256').update(first.participantCredential).digest('hex');
    pinStore.findJoinGrant.mockResolvedValue({
      eventId,
      sessionId,
      credentialId: 'credential-2',
      tokenDigest,
      title: 'Live Trivia',
      kind: 'live-trivia',
      status: 'lobby',
      active: true,
    });

    const replay = await service.joinActiveMultiplayerSession(joinInput(), undefined, '203.0.113.10');

    expect(replay).toEqual(first);
    expect(pinStore.createParticipantGrant).toHaveBeenCalledTimes(1);
  });

  it('rejects replay of a revoked grant with the same guest-safe failure', async () => {
    const { service, pinStore } = setup();
    const credential = createHmac('sha256', 'test-session-secret-for-event-games-123456')
      .update(`event-game:participant-credential:v1\0${eventId}\0${sessionId}\0${idempotencyKey}`)
      .digest('base64url');
    pinStore.findJoinGrant.mockResolvedValue({
      eventId,
      sessionId,
      credentialId: 'revoked-credential',
      tokenDigest: createHash('sha256').update(credential).digest('hex'),
      title: 'Live Trivia',
      kind: 'live-trivia',
      status: 'lobby',
      active: false,
    });

    await expect(service.joinActiveMultiplayerSession(joinInput(), undefined, '203.0.113.10'))
      .rejects.toMatchObject({ status: 404, message: 'Game session could not be joined' });
    expect(pinStore.createParticipantGrant).not.toHaveBeenCalled();
  });

  it('treats a missing active PIN reservation as joins being disabled', async () => {
    const { service, pinStore } = setup({ session: null });

    await expect(service.joinActiveMultiplayerSession(joinInput(), undefined, '203.0.113.10'))
      .rejects.toMatchObject({ status: 404, message: 'Game session could not be joined' });
    expect(pinStore.createParticipantGrant).not.toHaveBeenCalled();
  });

  it('rejects a credential retained for a different event with the same guest-safe failure', async () => {
    const { service, pinStore, rateLimiter } = setup({
      session: { eventId: 'event-2', sessionId, gameId: 'game-1', title: 'Trivia', kind: 'live-trivia', entryMode: 'active', status: 'lobby', expiresAt: new Date('2026-10-16T13:00:00.000Z') },
      event: { eventId: 'event-2', eventName: 'Second Event', archived: false, closed: false },
      credentialFound: false,
    });

    await expect(service.joinActiveMultiplayerSession(joinInput(), 'R'.repeat(43), '203.0.113.10'))
      .rejects.toMatchObject({ status: 404, message: 'Game session could not be joined' });
    expect(pinStore.createParticipantGrant).not.toHaveBeenCalled();
    expect(rateLimiter?.consume).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'failed_pin_attempt' }));
  });

  it('revokes the active reservation when a PIN lookup discovers a closed or archived event', async () => {
    const { service, pinStore, transaction } = setup({
      event: { eventId, eventName: 'Launch', archived: true, closed: false },
    });

    await expect(service.joinActiveMultiplayerSession(joinInput(), undefined, '203.0.113.10'))
      .rejects.toMatchObject({ status: 404, message: 'Game session could not be joined' });

    expect(pinStore.revokeSessionPin).toHaveBeenCalledWith({
      eventId,
      sessionId,
      actorId: 'system:event-closure',
      now,
      reason: 'closed',
    }, transaction);
  });

  it('uses one failure response for malformed, unknown, expired, closed, and Singleplayer PINs', async () => {
    const invalidSessions: Array<Record<string, unknown> | null> = [
      null,
      { eventId, sessionId, gameId: 'game-1', title: 'Trivia', kind: 'live-trivia', entryMode: 'independent', status: 'live', expiresAt: new Date('2026-10-16T13:00:00.000Z') },
      { eventId, sessionId, gameId: 'game-1', title: 'Trivia', kind: 'live-trivia', entryMode: 'active', status: 'completed', expiresAt: new Date('2026-10-16T13:00:00.000Z') },
      { eventId, sessionId, gameId: 'game-1', title: 'Trivia', kind: 'live-trivia', entryMode: 'active', status: 'lobby', expiresAt: new Date('2026-10-16T11:00:00.000Z') },
    ];
    const messages: Array<{ status: number; message: string }> = [];

    for (const session of invalidSessions) {
      const { service } = setup({ session });
      try {
        await service.joinActiveMultiplayerSession(joinInput(), undefined, '203.0.113.10');
      } catch (error) {
        const failure = error as HttpException;
        messages.push({ status: failure.getStatus(), message: String(failure.message) });
      }
    }
    const malformed = setup();
    try {
      await malformed.service.joinActiveMultiplayerSession(joinInput({ pin: 'not-six-digits' }), undefined, '203.0.113.10');
    } catch (error) {
      const failure = error as HttpException;
      messages.push({ status: failure.getStatus(), message: String(failure.message) });
    }
    const closedEvent = setup({ event: { eventId, eventName: 'Launch', archived: false, closed: true } });
    try {
      await closedEvent.service.joinActiveMultiplayerSession(joinInput(), undefined, '203.0.113.10');
    } catch (error) {
      const failure = error as HttpException;
      messages.push({ status: failure.getStatus(), message: String(failure.message) });
    }

    expect(messages).toHaveLength(6);
    expect(new Set(messages.map((item) => `${item.status}:${item.message}`))).toEqual(new Set(['404:Game session could not be joined']));
  });

  it('fails closed if the shared limiter is unavailable and returns only generic 429 when exhausted', async () => {
    const missingLimiter = setup({ rateLimiterAvailable: false });
    await expect(missingLimiter.service.joinActiveMultiplayerSession(joinInput(), undefined, '203.0.113.10'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(missingLimiter.pinStore.findJoinableSessionByPinDigest).not.toHaveBeenCalled();

    const limited = setup({ rateLimitAllowed: false });
    await expect(limited.service.joinActiveMultiplayerSession(joinInput(), undefined, '203.0.113.10'))
      .rejects.toMatchObject({ status: 429 });
    expect(limited.pinStore.findJoinableSessionByPinDigest).not.toHaveBeenCalled();
  });

  it('rejects an exhausted failed-PIN budget after confirming the submitted code missed', async () => {
    const { service, pinStore, rateLimiter } = setup({ session: null, pinFailureCheckAllowed: false });

    await expect(service.joinActiveMultiplayerSession(joinInput(), undefined, '203.0.113.10'))
      .rejects.toMatchObject({ status: 429 });

    expect(pinStore.findJoinableSessionByPinDigest).toHaveBeenCalledOnce();
    expect(rateLimiter?.consume).toHaveBeenCalledWith(expect.objectContaining({
      action: 'pin_failure_check',
      submittedPinDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it('does not let failed attempts against a known PIN digest lock out valid guests', async () => {
    const { service, pinStore, rateLimiter } = setup({ pinFailureCheckAllowed: false });

    const result = await service.joinActiveMultiplayerSession(joinInput(), undefined, '203.0.113.10');

    expect(result.sessionId).toBe(sessionId);
    expect(pinStore.createParticipantGrant).toHaveBeenCalledOnce();
    expect(rateLimiter?.consume).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'pin_failure_check' }));
  });

  it('converts a rolled-back grant invariant failure to the generic join response', async () => {
    const { service, pinStore, rateLimiter } = setup();
    pinStore.createParticipantGrant.mockRejectedValue(new GameParticipantGrantPersistenceError());

    await expect(service.joinActiveMultiplayerSession(joinInput(), undefined, '203.0.113.10'))
      .rejects.toMatchObject({ status: 404, message: 'Game session could not be joined' });

    expect(rateLimiter?.consume).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'failed_pin_attempt' }));
  });
});
