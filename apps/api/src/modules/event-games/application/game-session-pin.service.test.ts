import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismVerifiedEventActor } from '@prism/types';
import { describe, expect, it, vi } from 'vitest';
import { EventGamesSessionPinService } from './game-session-pin.service';

const eventId = 'event-1';
const sessionId = '00000000-0000-4000-8000-000000000002';
const idempotencyKey = '00000000-0000-4000-8000-000000000004';
const secret = 's'.repeat(48);
const now = new Date('2026-10-16T12:00:00.000Z');

function actor(): PrismVerifiedEventActor {
  return {
    id: 'actor-1', actorId: 'actor-1', role: 'coordinator', actorRole: 'coordinator',
    email: 'coordinator@example.test', actorEmail: 'coordinator@example.test',
    name: 'Coordinator', actorName: 'Coordinator', expiresAt: '2030-01-01T00:00:00.000Z',
  };
}

function createService(options: { secret?: string | null; jwtSecret?: string; alreadyIssued?: boolean; attempt?: number } = {}) {
  const transaction = { prisma: {}, correlationId: 'pin-test', actorId: 'actor-1' } as PrismTransactionContext;
  const transactions = {
    run: vi.fn(async (work: (context: PrismTransactionContext) => Promise<unknown>) => work(transaction)),
  };
  const access = { assertHostAccess: vi.fn().mockResolvedValue(undefined) };
  const hostCommands = {
    executeHostCommand: vi.fn().mockResolvedValue({
      eventId, resourceType: 'session', resourceId: sessionId, action: 'enable_joins',
      outcome: 'joins_enabled', resultId: sessionId, requestReceiptId: 'request-digest',
      generationAttempt: options.attempt ?? 0,
      transition: { beforeStatus: 'closed', afterStatus: 'open', beforeVersion: null, afterVersion: null },
    }),
  };
  let lookupCount = 0;
  const pinStore = {
    findActivePinByIdempotencyDigest: vi.fn(async () => {
      lookupCount += 1;
      if (lookupCount === 1 && options.alreadyIssued) {
        return { pinDigest: 'existing-digest', generationAttempt: 0, expiresAt: new Date(now.getTime() + 1000) };
      }
      if (lookupCount < 2) return null;
      const command = hostCommands.executeHostCommand.mock.calls[0]?.[0] as {
        command: { pinCandidates: Array<{ pinDigest: string }>; expiresAt: string };
      } | undefined;
      return {
        pinDigest: command?.command.pinCandidates[options.attempt ?? 0]?.pinDigest ?? 'missing',
        generationAttempt: options.attempt ?? 0,
        expiresAt: new Date(command?.command.expiresAt ?? now),
      };
    }),
  };
  const config = { get: vi.fn((key: string) => {
    if (key === 'PRISM_SESSION_SECRET') return options.secret === undefined ? secret : options.secret ?? undefined;
    if (key === 'JWT_SECRET') return options.jwtSecret;
    if (key === 'EVENT_GAME_PIN_TTL_HOURS') return undefined;
    return undefined;
  }) };
  return {
    service: new EventGamesSessionPinService(access as never, pinStore as never, hostCommands as never, transactions as never, config as never, () => now),
    access, pinStore, hostCommands, transactions,
  };
}

describe('EventGamesSessionPinService', () => {
  it('issues a six-digit PIN once and sends only keyed digests to persistence and command receipts', async () => {
    const { service, access, pinStore, hostCommands, transactions, } = createService({ attempt: 1 });

    const result = await service.issueSessionPin(eventId, sessionId, actor(), { idempotencyKey, reason: 'Start round' });

    expect(result.pin).toMatch(/^\d{6}$/);
    expect(result.expiresAt).toBe(new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString());
    expect(access.assertHostAccess).toHaveBeenCalledWith(eventId, expect.objectContaining({ actorId: 'actor-1' }));
    expect(pinStore.findActivePinByIdempotencyDigest).toHaveBeenCalledTimes(2);
    expect(transactions.run).toHaveBeenCalledTimes(2);
    expect(hostCommands.executeHostCommand).toHaveBeenCalledWith(expect.objectContaining({
      eventId,
      actor: expect.objectContaining({ actorId: 'actor-1' }),
      resourceType: 'session',
      resourceId: sessionId,
      action: 'enable_joins',
      requestReceiptId: expect.not.stringContaining(idempotencyKey),
      command: expect.objectContaining({
        command: 'enable-joins',
        expiresAt: result.expiresAt,
        pinCandidates: expect.arrayContaining([expect.objectContaining({ pinDigest: expect.any(String) })]),
      }),
    }));
    const serializedCommand = JSON.stringify(hostCommands.executeHostCommand.mock.calls[0]?.[0]);
    expect(serializedCommand).not.toContain(result.pin);
    expect(serializedCommand).not.toContain(idempotencyKey);
    expect(serializedCommand).toContain('pinDigest');
  });

  it('requires rotation instead of revealing an already issued PIN a second time', async () => {
    const { service, hostCommands } = createService({ alreadyIssued: true });

    await expect(service.issueSessionPin(eventId, sessionId, actor(), { idempotencyKey }))
      .rejects.toBeInstanceOf(ConflictException);

    expect(hostCommands.executeHostCommand).not.toHaveBeenCalled();
  });

  it('fails closed without a configured session secret', async () => {
    const { service, access, hostCommands } = createService({ secret: '' });

    await expect(service.issueSessionPin(eventId, sessionId, actor(), { idempotencyKey }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(access.assertHostAccess).not.toHaveBeenCalled();
    expect(hostCommands.executeHostCommand).not.toHaveBeenCalled();
  });

  it('uses the established JWT secret fallback when no session secret is configured', async () => {
    const { service, hostCommands } = createService({ secret: null, jwtSecret: secret });

    const result = await service.issueSessionPin(eventId, sessionId, actor(), { idempotencyKey });

    expect(result.pin).toMatch(/^\d{6}$/);
    expect(hostCommands.executeHostCommand).toHaveBeenCalledOnce();
  });

  it('does not reveal a candidate when a concurrent retry did not reserve it', async () => {
    const { service, pinStore } = createService();
    pinStore.findActivePinByIdempotencyDigest.mockReset().mockResolvedValue(null);

    await expect(service.issueSessionPin(eventId, sessionId, actor(), { idempotencyKey }))
      .rejects.toBeInstanceOf(ConflictException);
  });
});
