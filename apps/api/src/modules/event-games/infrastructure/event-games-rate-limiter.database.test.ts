import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { EventGamesPostgresRateLimiter } from './event-games-postgres-rate-limiter.adapter';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();

function validateDatabaseUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55437' || parsed.pathname !== '/prism_p0') {
    throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
  }
}

if (databaseUrl) validateDatabaseUrl(databaseUrl);

const databaseSuite = describe.skipIf(!databaseUrl);

databaseSuite('event game shared rate-limit PostgreSQL invariants', () => {
  let prisma: PrismaService;
  let limiter: EventGamesPostgresRateLimiter;
  const unique = randomUUID();
  const retainedBucketKeys: string[] = [];

  beforeAll(async () => {
    if (!databaseUrl) return;
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) {
      process.env[variable] = databaseUrl;
    }
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();

    const config = { get: (key: string) => {
      const values: Record<string, string> = {
        EVENT_GAME_PIN_ATTEMPTS_GLOBAL_PER_MINUTE: '4',
        EVENT_GAME_PIN_ATTEMPTS_PER_SOURCE_PER_MINUTE: '3',
        EVENT_GAME_PIN_FAILURES_GLOBAL_PER_MINUTE: '4',
        EVENT_GAME_PIN_FAILURES_PER_SOURCE_PER_MINUTE: '100',
        EVENT_GAME_PIN_FAILURES_PER_DIGEST_PER_MINUTE: '2',
      };
      return values[key];
    } };
    limiter = new EventGamesPostgresRateLimiter(new PrismTransactionRunner(prisma), config as never);
  });

  afterAll(async () => {
    if (!prisma) return;
    if (retainedBucketKeys.length > 0) {
      await prisma.$executeRaw`
        DELETE FROM "event_games"."rate_limit_buckets"
        WHERE "bucket_key" = ANY(${retainedBucketKeys}::text[])
      `;
    }
    await prisma.$disconnect();
  });

  function bucketKey(...components: string[]) {
    const key = createHash('sha256')
      .update(['prism', 'event-games', 'rate-limit', 'v1', ...components].join('\0'))
      .digest('hex');
    retainedBucketKeys.push(key);
    return key;
  }

  function pinRequest(sourceFingerprint: string, submittedPinDigest: string, globalBudgetKey: string) {
    const buckets = [
      bucketKey('global', 'pin-join-global', 'pin_attempt', globalBudgetKey),
      bucketKey('source', 'pin-join-source', 'pin_attempt', 'global', sourceFingerprint),
    ];
    return {
      action: 'pin_attempt' as const,
      sourceFingerprint,
      globalBudgetKey,
      buckets,
    };
  }

  function failedPinRequest(sourceFingerprint: string, submittedPinDigest: string, globalBudgetKey: string) {
    const buckets = [
      bucketKey('global', 'pin-failure-global', 'failed_pin_attempt', globalBudgetKey),
      bucketKey('source', 'pin-failure-source', 'failed_pin_attempt', 'global', sourceFingerprint),
      bucketKey('pin-failure-digest', submittedPinDigest),
    ];
    return {
      action: 'failed_pin_attempt' as const,
      sourceFingerprint,
      submittedPinDigest,
      globalBudgetKey,
      buckets,
    };
  }

  it('atomically composes source, PIN-digest, and global budgets under concurrent attempts', async () => {
    const sourceLimited = pinRequest(`source-${unique}-a`, `pin-${unique}-a`, `global-${unique}-source`);
    const sourceResults = await Promise.all(Array.from({ length: 12 }, () => limiter.consume(sourceLimited)));
    expect(sourceResults.filter(({ allowed }) => allowed)).toHaveLength(3);

    const digestLimitedRequests = Array.from({ length: 8 }, (_, index) =>
      failedPinRequest(`source-${unique}-digest-${index}`, `pin-${unique}-shared`, `global-${unique}-digest`),
    );
    const digestResults = await Promise.all(digestLimitedRequests.map((request) => limiter.consume(request)));
    expect(digestResults.filter(({ allowed }) => allowed)).toHaveLength(2);

    const globalLimitedRequests = Array.from({ length: 6 }, (_, index) =>
      failedPinRequest(`source-${unique}-global-${index}`, `pin-${unique}-global-${index}`, `global-${unique}-shared`),
    );
    const globalResults = await Promise.all(globalLimitedRequests.map((request) => limiter.consume(request)));
    expect(globalResults.filter(({ allowed }) => allowed)).toHaveLength(4);

    const [sourceCount, digestCount, globalCount] = await Promise.all([
      prisma.$queryRaw<Array<{ request_count: number }>>`
        SELECT "request_count" FROM "event_games"."rate_limit_buckets"
        WHERE "bucket_key" = ${sourceLimited.buckets[1]}
      `,
      prisma.$queryRaw<Array<{ request_count: number }>>`
        SELECT "request_count" FROM "event_games"."rate_limit_buckets"
        WHERE "bucket_key" = ${digestLimitedRequests[0]?.buckets[2]}
      `,
      prisma.$queryRaw<Array<{ request_count: number }>>`
        SELECT "request_count" FROM "event_games"."rate_limit_buckets"
        WHERE "bucket_key" = ${globalLimitedRequests[0]?.buckets[0]}
      `,
    ]);
    expect(sourceCount[0]?.request_count).toBe(4);
    expect(digestCount[0]?.request_count).toBe(3);
    expect(globalCount[0]?.request_count).toBe(5);
  });
});
