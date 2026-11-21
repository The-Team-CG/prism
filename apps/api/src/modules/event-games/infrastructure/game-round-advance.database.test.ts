import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { EventGamesPersistenceAdapter } from './event-games-persistence.adapter';
import { EventGamesPinPrismaStoreAdapter } from './event-games-pin-prisma-store.adapter';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();

function validateDatabaseUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55437' || parsed.pathname !== '/prism_p0') {
    throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
  }
}

if (databaseUrl) validateDatabaseUrl(databaseUrl);

const databaseSuite = describe.skipIf(!databaseUrl);

databaseSuite('event game round advance against PostgreSQL', () => {
  let prisma: PrismaService | undefined;
  const eventId = randomUUID();
  const gameId = randomUUID();
  const configVersionId = randomUUID();

  async function insertSession(status: 'live' | 'paused') {
    const sessionId = randomUUID();
    // NOW() carries microseconds, as a host start or pause wrote it before the columns were stored to the millisecond.
    await prisma!.$executeRaw`
      INSERT INTO "event_games"."game_sessions" (
        "id", "event_id", "game_definition_id", "config_version_id", "config_snapshot",
        "entry_mode", "status", "started_at", "paused_at", "created_by", "created_at", "updated_at"
      ) VALUES (
        ${sessionId}, ${eventId}, ${gameId}, ${configVersionId}, '{}'::jsonb,
        'active', ${status}, NOW() - interval '90 seconds', ${status === 'paused' ? new Date() : null}::timestamptz, 'p0-test', NOW(), NOW()
      )
    `;
    if (status === 'paused') {
      await prisma!.$executeRaw`UPDATE "event_games"."game_sessions" SET "paused_at" = NOW() WHERE "id" = ${sessionId}`;
    }
    return sessionId;
  }

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
      ) VALUES (${gameId}, ${eventId}, ${gameId}, 'Round advance test', 'live-trivia', 'active', 'published', 'p0-test', NOW(), NOW())
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_config_versions" ("id", "game_definition_id", "event_id", "version", "config", "created_by", "created_at")
      VALUES (${configVersionId}, ${gameId}, ${eventId}, 1, '{}'::jsonb, 'p0-test', NOW())
    `;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_sessions" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_config_versions" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_definitions" WHERE "event_id" = ${eventId}`;
    await prisma.$disconnect();
  });

  it.each(['live', 'paused'] as const)('advances a %s session whose start was stored with microseconds, as the host reads it', async (status) => {
    const sessionId = await insertSession(status);
    const adapter = new EventGamesPersistenceAdapter(new EventGamesPinPrismaStoreAdapter());
    // The service reads the session through Prisma, which gives millisecond Dates, and sends them back as expected values.
    const session = await prisma!.eventGameSession.findUniqueOrThrow({ where: { id: sessionId } });

    const advanced = await adapter.executeHostCommand({
      eventId, actorId: 'p0-test', resourceType: 'session', resourceId: sessionId, action: 'advance_round', requestReceiptId: randomUUID(),
      command: {
        expectedRoundKey: 'round:0', advanceByMs: 30_000, expectedRoundOffsetMs: 0, expectedStatus: status,
        expectedStartedAt: session.startedAt!.toISOString(), expectedPausedAt: session.pausedAt?.toISOString() ?? null, expectedTotalPausedMs: 0,
      },
    }, { prisma: prisma! } as never);

    expect(advanced).toMatchObject({ outcome: 'advanced', resourceId: sessionId });
    const after = await prisma!.eventGameSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(after.roundOffsetMs).toBe(30_000);
  });
});
