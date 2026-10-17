import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { EventGamesPostgresRateLimiter } from './event-games-postgres-rate-limiter.adapter';

function setup(returningCounts: number[]) {
  let nextCountIndex = 0;
  const queryRaw = vi.fn(async (..._args: unknown[]) => [{ request_count: returningCounts[nextCountIndex++] ?? 1 }]);
  const executeRaw = vi.fn(async (..._args: unknown[]) => 0);
  const transaction = { prisma: { $queryRaw: queryRaw, $executeRaw: executeRaw }, actorId: 'rate-limit-test', correlationId: 'rate-limit-test' } as unknown as PrismTransactionContext;
  const transactions = { run: vi.fn(async (work: (tx: PrismTransactionContext) => Promise<unknown>) => work(transaction)) };
  const config = { get: vi.fn((key: string) => {
    const settings: Record<string, string> = {
      EVENT_GAME_PIN_ATTEMPTS_PER_SOURCE_PER_MINUTE: '2',
      EVENT_GAME_PIN_ATTEMPTS_PER_DIGEST_PER_MINUTE: '3',
      EVENT_GAME_PIN_ATTEMPTS_GLOBAL_PER_MINUTE: '5',
      EVENT_GAME_PIN_FAILURES_PER_SOURCE_PER_MINUTE: '4',
      EVENT_GAME_PIN_FAILURES_GLOBAL_PER_MINUTE: '4',
      EVENT_GAME_PIN_FAILURES_PER_DIGEST_PER_MINUTE: '2',
    };
    return settings[key];
  }) };
  const limiter = new EventGamesPostgresRateLimiter(transactions as never, config as never, () => new Date('2026-10-16T12:34:45.000Z'));
  return { limiter, queryRaw, executeRaw, transactions };
}

describe('EventGamesPostgresRateLimiter', () => {
  it('composes pre-lookup global and source budgets without persisting raw identifiers', async () => {
    const { limiter, queryRaw } = setup([1, 1]);

    await expect(limiter.consume({
      action: 'pin_attempt',
      sourceFingerprint: 'hmac:trusted-source-fingerprint',
      globalBudgetKey: 'event-game:pin-attempts',
    })).resolves.toEqual({ allowed: true });

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(queryRaw.mock.calls.map((call) => call[4])).toEqual([2, 5]);
    const persistedValues = queryRaw.mock.calls.map((call) => JSON.stringify(call));
    expect(persistedValues.join('\n')).not.toContain('trusted-source-fingerprint');
    expect(persistedValues.join('\n')).not.toContain('event-game:pin-attempts');
  });

  it('denies a source that exceeds its budget while retaining atomic upsert statements', async () => {
    const { limiter, queryRaw } = setup([3]);

    await expect(limiter.consume({
      action: 'pin_attempt',
      sourceFingerprint: 'hmac:source',
      globalBudgetKey: 'event-game:pin-attempts',
    })).resolves.toMatchObject({ allowed: false, retryAfterSeconds: expect.any(Number) });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const statement = queryRaw.mock.calls[0]?.[0] as unknown as TemplateStringsArray;
    expect(Array.from(statement).join(' ')).toMatch(/ON CONFLICT[\s\S]*DO UPDATE[\s\S]*RETURNING/i);
  });

  it('enforces a separate global failed-PIN budget', async () => {
    const { limiter, queryRaw } = setup([1, 1, 5]);

    await expect(limiter.consume({
      action: 'failed_pin_attempt',
      sourceFingerprint: 'hmac:source',
      submittedPinDigest: 'hmac:pin',
      globalBudgetKey: 'event-game:failed-pin-attempts',
    })).resolves.toMatchObject({ allowed: false });

    expect(queryRaw).toHaveBeenCalledTimes(3);
    expect(queryRaw.mock.calls.map((call) => call[4])).toEqual([2, 4, 4]);
  });

  it('allows more than ten valid joins sharing a venue source and submitted PIN digest', async () => {
    const counts = new Map<string, number>();
    const queryRaw = vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const key = String(values[0]);
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return [{ request_count: count }];
    });
    const transaction = { prisma: { $queryRaw: queryRaw, $executeRaw: vi.fn(async () => 0) } } as unknown as PrismTransactionContext;
    const transactions = { run: vi.fn(async (work: (tx: PrismTransactionContext) => Promise<unknown>) => work(transaction)) };
    const config = { get: vi.fn(() => undefined) };
    const limiter = new EventGamesPostgresRateLimiter(transactions as never, config as never, () => new Date('2026-10-16T12:34:45.000Z'));

    const results = await Promise.all(Array.from({ length: 11 }, () => limiter.consume({
      action: 'pin_attempt',
      sourceFingerprint: 'same-venue-source',
      globalBudgetKey: 'event-game:pin-attempts',
    })));

    expect(results.every(({ allowed }) => allowed)).toBe(true);
    expect(queryRaw).toHaveBeenCalledTimes(22);
  });

  it('retains a per-digest cap for failed PIN attempts', async () => {
    const counts = new Map<string, number>();
    const queryRaw = vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const key = String(values[0]);
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return [{ request_count: count }];
    });
    const transaction = { prisma: { $queryRaw: queryRaw, $executeRaw: vi.fn(async () => 0) } } as unknown as PrismTransactionContext;
    const transactions = { run: vi.fn(async (work: (tx: PrismTransactionContext) => Promise<unknown>) => work(transaction)) };
    const settings: Record<string, string> = {
      EVENT_GAME_PIN_FAILURES_PER_SOURCE_PER_MINUTE: '100',
      EVENT_GAME_PIN_FAILURES_PER_DIGEST_PER_MINUTE: '2',
      EVENT_GAME_PIN_FAILURES_GLOBAL_PER_MINUTE: '100',
    };
    const config = { get: vi.fn((key: string) => settings[key]) };
    const limiter = new EventGamesPostgresRateLimiter(transactions as never, config as never, () => new Date('2026-10-16T12:34:45.000Z'));

    const results = await Promise.all(Array.from({ length: 3 }, () => limiter.consume({
      action: 'failed_pin_attempt',
      sourceFingerprint: 'same-venue-source',
      submittedPinDigest: 'same-pin-digest',
      globalBudgetKey: 'event-game:pin-attempts',
    })));

    expect(results.filter(({ allowed }) => allowed)).toHaveLength(2);
    expect(results.filter(({ allowed }) => !allowed)).toHaveLength(1);
  });

  it('preflights accumulated failed-PIN budgets with reads only', async () => {
    const { limiter, queryRaw } = setup([2]);

    await expect(limiter.consume({
      action: 'pin_failure_check',
      sourceFingerprint: 'hmac:source',
      submittedPinDigest: 'hmac:pin',
      globalBudgetKey: 'event-game:pin-attempts',
    })).resolves.toMatchObject({ allowed: false });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    for (const [strings] of queryRaw.mock.calls as unknown as Array<[TemplateStringsArray]>) {
      expect(Array.from(strings).join(' ')).toContain('SELECT "request_count"');
      expect(Array.from(strings).join(' ')).not.toContain('INSERT INTO');
    }
  });

  it('checks source limits before global increments so one blocked source cannot drain the shared budget', async () => {
    const counts = new Map<string, number>();
    const queryRaw = vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const key = String(values[0]);
      const maxRequests = Number(values[3]);
      const count = Math.min((counts.get(key) ?? 0) + 1, maxRequests + 1);
      counts.set(key, count);
      return [{ request_count: count }];
    });
    const transaction = { prisma: { $queryRaw: queryRaw, $executeRaw: vi.fn(async () => 0) } } as unknown as PrismTransactionContext;
    const transactions = { run: vi.fn(async (work: (tx: PrismTransactionContext) => Promise<unknown>) => work(transaction)) };
    const config = { get: vi.fn((key: string) => ({
      EVENT_GAME_PIN_ATTEMPTS_PER_SOURCE_PER_MINUTE: '1',
      EVENT_GAME_PIN_ATTEMPTS_GLOBAL_PER_MINUTE: '2',
    } as Record<string, string>)[key]) };
    const limiter = new EventGamesPostgresRateLimiter(transactions as never, config as never, () => new Date('2026-10-16T12:34:45.000Z'));
    const consume = (sourceFingerprint: string) => limiter.consume({
      action: 'pin_attempt', sourceFingerprint, globalBudgetKey: 'event-game:pin-attempts',
    });

    await expect(consume('source-a')).resolves.toEqual({ allowed: true });
    await expect(consume('source-a')).resolves.toMatchObject({ allowed: false });
    await expect(consume('source-a')).resolves.toMatchObject({ allowed: false });
    await expect(consume('source-b')).resolves.toEqual({ allowed: true });

    const sourceAKey = String(queryRaw.mock.calls[0]?.[1]);
    const globalKey = String(queryRaw.mock.calls[1]?.[1]);
    expect(counts.get(sourceAKey)).toBe(2);
    expect(counts.get(globalKey)).toBe(2);
  });

  it.each([
    ['lobby_read', 'EVENT_GAME_LOBBY_READS_PER_SOURCE_PER_MINUTE', 'EVENT_GAME_LOBBY_READS_GLOBAL_PER_MINUTE'],
    ['lobby_start', 'EVENT_GAME_LOBBY_STARTS_PER_SOURCE_PER_MINUTE', 'EVENT_GAME_LOBBY_STARTS_GLOBAL_PER_MINUTE'],
  ] as const)('%s checks its source bucket before the shared global bucket', async (action, sourceSetting, globalSetting) => {
    const counts = new Map<string, number>();
    const queryRaw = vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const key = String(values[0]);
      const maxRequests = Number(values[3]);
      const count = Math.min((counts.get(key) ?? 0) + 1, maxRequests + 1);
      counts.set(key, count);
      return [{ request_count: count }];
    });
    const transaction = { prisma: { $queryRaw: queryRaw, $executeRaw: vi.fn(async () => 0) } } as unknown as PrismTransactionContext;
    const transactions = { run: vi.fn(async (work: (tx: PrismTransactionContext) => Promise<unknown>) => work(transaction)) };
    const settings: Record<string, string> = { [sourceSetting]: '1', [globalSetting]: '2' };
    const config = { get: vi.fn((key: string) => settings[key]) };
    const limiter = new EventGamesPostgresRateLimiter(transactions as never, config as never, () => new Date('2026-10-16T12:34:45.000Z'));
    const consume = (sourceFingerprint: string) => limiter.consume({
      action,
      eventId: 'event-1',
      sourceFingerprint,
      globalBudgetKey: 'event-game:lobby-budget',
    });

    await expect(consume('source-a')).resolves.toEqual({ allowed: true });
    await expect(consume('source-a')).resolves.toMatchObject({ allowed: false });
    await expect(consume('source-b')).resolves.toEqual({ allowed: true });

    const increments = queryRaw.mock.calls.map((call) => Number(call[4]));
    expect(increments).toEqual([1, 2, 1, 1, 2]);
    const sourceAKey = String(queryRaw.mock.calls[0]?.[1]);
    const globalKey = String(queryRaw.mock.calls[1]?.[1]);
    expect(counts.get(sourceAKey)).toBe(2);
    expect(counts.get(globalKey)).toBe(2);
  });

  it('uses venue-safe configurable defaults for lobby reads and starts', async () => {
    const { limiter, queryRaw } = setup([1, 1, 1, 1]);
    await limiter.consume({ action: 'lobby_read', eventId: 'event-1', sourceFingerprint: 'source', globalBudgetKey: 'read' });
    await limiter.consume({ action: 'lobby_start', eventId: 'event-1', sourceFingerprint: 'source', globalBudgetKey: 'start' });

    expect(queryRaw.mock.calls.map((call) => call[4])).toEqual([10_000, 20_000, 5_000, 5_000]);
  });

  it('cleans rate-limit rows when their stored retention expiry is reached', async () => {
    const { limiter, executeRaw } = setup([1, 1]);
    const now = new Date('2026-10-16T12:34:45.000Z');

    await limiter.consume({
      action: 'pin_attempt',
      sourceFingerprint: 'source',
      globalBudgetKey: 'event-game:pin-attempts',
    });

    expect(executeRaw).toHaveBeenCalledOnce();
    expect(executeRaw.mock.calls[0]?.[1]).toEqual(now);
    expect(executeRaw.mock.calls[0]?.[2]).toBe(20_000);
  });
});
