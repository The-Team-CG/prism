import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { GameScheduledStartWorker } from '../application/game-scheduled-start.worker';
import { EventGamesPinPrismaStoreAdapter } from './event-games-pin-prisma-store.adapter';
import { EventGamesPrismaStoreAdapter } from './event-games-prisma-store.adapter';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();

function validateDatabaseUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55437' || parsed.pathname !== '/prism_p0') {
    throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
  }
}

if (databaseUrl) validateDatabaseUrl(databaseUrl);

const databaseSuite = describe.skipIf(!databaseUrl);

databaseSuite('event game scheduled-start PostgreSQL invariants', () => {
  let prisma: PrismaService | undefined;
  const eventId = randomUUID();
  const gameId = randomUUID();
  const configVersionId = randomUUID();
  const sessionId = randomUUID();
  const startIdempotencyKey = randomUUID();
  const startedGameId = randomUUID();
  const startedConfigVersionId = randomUUID();
  const startedSessionId = randomUUID();

  beforeAll(async () => {
    if (!databaseUrl) return;
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) {
      process.env[variable] = databaseUrl;
    }
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();
    const scheduledStartAt = new Date(Date.now() - 60_000);
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_definitions" (
        "id", "event_id", "slug", "title", "game_kind", "entry_mode", "status",
        "created_by", "created_at", "updated_at"
      ) VALUES (
        ${gameId}, ${eventId}, ${gameId}, 'Scheduled start test',
        'live-trivia', 'active', 'published', 'p0-test', NOW(), NOW()
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
        "id", "event_id", "game_definition_id", "config_version_id", "config_snapshot",
        "entry_mode", "status", "scheduled_start_at", "created_by",
        "start_idempotency_key", "created_at", "updated_at"
      ) VALUES (
        ${sessionId}, ${eventId}, ${gameId}, ${configVersionId}, '{}'::jsonb,
        'active', 'scheduled', ${scheduledStartAt}, 'p0-test',
        ${startIdempotencyKey}, NOW(), NOW()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_definitions" (
        "id", "event_id", "slug", "title", "game_kind", "entry_mode", "status",
        "created_by", "created_at", "updated_at"
      ) VALUES (
        ${startedGameId}, ${eventId}, ${startedGameId}, 'Started game archive guard',
        'live-trivia', 'active', 'published', 'p0-test', NOW(), NOW()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_config_versions" (
        "id", "game_definition_id", "event_id", "version", "config", "created_by", "created_at"
      ) VALUES (
        ${startedConfigVersionId}, ${startedGameId}, ${eventId}, 1, '{}'::jsonb, 'p0-test', NOW()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_sessions" (
        "id", "event_id", "game_definition_id", "config_version_id", "config_snapshot",
        "entry_mode", "status", "started_at", "created_by", "start_idempotency_key", "created_at", "updated_at"
      ) VALUES (
        ${startedSessionId}, ${eventId}, ${startedGameId}, ${startedConfigVersionId}, '{}'::jsonb,
        'active', 'live', NOW(), 'p0-test', ${startedSessionId}, NOW(), NOW()
      )
    `;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_sessions" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_config_versions" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_definitions" WHERE "event_id" = ${eventId}`;
    await prisma.$disconnect();
  });

  it('starts a due session once across concurrent and repeated worker delivery', async () => {
    const audit = { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
    const worker = new GameScheduledStartWorker(
      prisma!,
      new PrismTransactionRunner(prisma!),
      audit as never,
      new EventGamesPinPrismaStoreAdapter(),
      { isEventOpen: vi.fn().mockResolvedValue(true) } as never,
    );
    const now = new Date();

    const [first, concurrent] = await Promise.all([
      worker.runDueStarts(now),
      worker.runDueStarts(now),
    ]);
    const repeated = await worker.runDueStarts(now);
    const rows = await prisma!.$queryRaw<Array<{ status: string; started_at: Date | null }>>`
      SELECT status, started_at FROM "event_games"."game_sessions"
      WHERE event_id = ${eventId} AND id = ${sessionId}
    `;

    expect(first + concurrent + repeated).toBe(1);
    expect(rows[0]).toMatchObject({ status: 'live' });
    expect(rows[0]?.started_at).toBeInstanceOf(Date);
    expect(audit.recordHostWrite).toHaveBeenCalledOnce();
    expect(audit.recordHostWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId,
        actorId: 'system:event-games-scheduler',
        action: 'start_session',
        resourceId: sessionId,
        requestReceiptId: startIdempotencyKey,
      }),
      expect.any(Object),
    );
  });

  it('does not archive a game with a started session', async () => {
    const store = new EventGamesPrismaStoreAdapter();
    const result = await new PrismTransactionRunner(prisma!).run(
      (transaction) => store.removeUnstartedGame({ eventId, gameId: startedGameId, actorId: 'p0-test' }, transaction),
      { actorId: 'p0-test' },
    );

    expect(result).toBeNull();
  });
});
