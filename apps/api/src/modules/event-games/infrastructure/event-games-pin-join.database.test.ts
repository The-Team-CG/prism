import 'reflect-metadata';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { EventGamesSessionJoinService } from '../application/game-session-join.service';
import { EventGamesPinPrismaStoreAdapter } from './event-games-pin-prisma-store.adapter';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const sessionSecret = 'p0-test-event-game-session-secret-0123456789';

function validateDatabaseUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55437' || parsed.pathname !== '/prism_p0') {
    throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
  }
}

if (databaseUrl) validateDatabaseUrl(databaseUrl);

const databaseSuite = describe.skipIf(!databaseUrl);

databaseSuite('event game PIN join PostgreSQL invariants', () => {
  let prisma: PrismaService;
  const eventId = randomUUID();
  const gameId = randomUUID();
  const configVersionId = randomUUID();
  const sessionId = randomUUID();
  const pin = '042681';
  const idempotencyKey = randomUUID();
  const pinDigest = createHmac('sha256', sessionSecret).update(`event-game:pin:v1\0${pin}`).digest('hex');
  const token = createHmac('sha256', sessionSecret)
    .update(`event-game:participant-credential:v1\0${eventId}\0${sessionId}\0${idempotencyKey}`)
    .digest('base64url');
  const tokenDigest = createHash('sha256').update(token).digest('hex');
  const idempotencyKeyDigest = createHmac('sha256', sessionSecret)
    .update(`event-game:join-idempotency:v1\0${idempotencyKey}`).digest('base64url');

  beforeAll(async () => {
    if (!databaseUrl) return;
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) {
      process.env[variable] = databaseUrl;
    }
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_definitions" (
        "id", "event_id", "slug", "title", "game_kind", "entry_mode", "status", "created_by", "created_at", "updated_at"
      ) VALUES (
        ${gameId}, ${eventId}, ${gameId}, 'Join replay test', 'live-trivia', 'active', 'published', 'p0-test', NOW(), NOW()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_config_versions" (
        "id", "game_definition_id", "event_id", "version", "config", "created_by", "created_at"
      ) VALUES (
        ${configVersionId}, ${gameId}, ${eventId}, 1, '{}'::jsonb, 'p0-test', NOW()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_sessions" (
        "id", "event_id", "game_definition_id", "config_version_id", "config_snapshot", "entry_mode", "status",
        "created_by", "start_idempotency_key", "created_at", "updated_at"
      ) VALUES (
        ${sessionId}, ${eventId}, ${gameId}, ${configVersionId}, '{}'::jsonb, 'active', 'lobby',
        'p0-test', ${randomUUID()}, NOW(), NOW()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."active_pin_reservations" (
        "id", "event_id", "session_id", "pin_digest", "expires_at", "reserved_at"
      ) VALUES (
        ${randomUUID()}, ${eventId}, ${sessionId}, ${pinDigest}, NOW() + INTERVAL '1 hour', NOW()
      )
    `;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRaw`DELETE FROM "event_games"."active_pin_reservations" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."session_participation_grants" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."participant_credentials" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_sessions" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_config_versions" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_definitions" WHERE "event_id" = ${eventId}`;
    await prisma.$disconnect();
  });

  it('serializes concurrent retries into one credential and one participation grant', async () => {
    const store = new EventGamesPinPrismaStoreAdapter();
    const eventAccess = {
      getPublicEventScope: async (candidateEventId: string) => ({
        eventId: candidateEventId, eventName: 'P0 test', archived: false, closed: false,
      }),
      isEventOpen: async (candidateEventId: string) => candidateEventId === eventId,
    };
    const limiter = { consume: async () => ({ allowed: true }) };
    const config = { get: (key: string) => key === 'PRISM_SESSION_SECRET' ? sessionSecret : 'test' };
    const service = new EventGamesSessionJoinService(
      eventAccess as never,
      store,
      new PrismTransactionRunner(prisma),
      limiter,
      config as never,
      () => new Date(),
    );

    const input = { idempotencyKey, pin };
    const [first, retry] = await Promise.all([
      service.joinActiveMultiplayerSession(input, undefined, '127.0.0.1'),
      service.joinActiveMultiplayerSession(input, undefined, '127.0.0.1'),
    ]);

    expect(retry).toEqual(first);
    expect(first.participantCredential).toBe(token);
    const [credentialRows, grantRows] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS "count" FROM "event_games"."participant_credentials"
        WHERE "event_id" = ${eventId} AND "token_digest" = ${tokenDigest}
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS "count" FROM "event_games"."session_participation_grants"
        WHERE "event_id" = ${eventId} AND "session_id" = ${sessionId}
          AND "join_idempotency_key_digest" = ${idempotencyKeyDigest}
      `,
    ]);
    expect(credentialRows[0]?.count).toBe(1n);
    expect(grantRows[0]?.count).toBe(1n);
  });
});
