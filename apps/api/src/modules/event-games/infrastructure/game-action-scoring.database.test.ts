import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { PrismAssignEventGameAwardInput } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventGamesActionPrismaStoreAdapter } from './event-games-action-prisma-store.adapter';
import { EventGamesAwardPrismaStoreAdapter } from './event-games-award-prisma-store.adapter';
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

databaseSuite('Event games action and team scoring PostgreSQL invariants', () => {
  let prisma: PrismaService;
  const eventId = randomUUID();
  const definitionId = randomUUID();
  const configVersionId = randomUUID();
  const sessionId = randomUUID();
  const credentialIds = [randomUUID(), randomUUID()];
  const grantIds = [randomUUID(), randomUUID()];
  const teamId = randomUUID();
  const now = new Date('2026-10-16T12:00:00.000Z');
  const tokenDigests = [`sha256:${randomUUID()}`, `sha256:${randomUUID()}`];
  const actionStore = new EventGamesActionPrismaStoreAdapter();

  beforeAll(async () => {
    if (!databaseUrl) return;
    for (const variable of ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL']) {
      process.env[variable] = databaseUrl;
    }
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    await prisma.$connect();

    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_definitions"
        ("id", "event_id", "slug", "title", "game_kind", "entry_mode", "status", "created_by", "updated_at")
      VALUES (${definitionId}, ${eventId}, ${definitionId}, 'Scoring invariant', 'live-trivia', 'active', 'published', 'p0-test', ${now})
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_config_versions"
        ("id", "game_definition_id", "event_id", "version", "config", "created_by")
      VALUES (${configVersionId}, ${definitionId}, ${eventId}, 1, '{}'::jsonb, 'p0-test')
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_sessions"
        ("id", "event_id", "game_definition_id", "config_version_id", "config_snapshot", "entry_mode",
         "status", "started_at", "created_by", "start_idempotency_key", "updated_at")
      VALUES (${sessionId}, ${eventId}, ${definitionId}, ${configVersionId}, '{}'::jsonb, 'active',
        'live', ${now}, 'p0-test', ${sessionId}, ${now})
    `;
    for (let index = 0; index < credentialIds.length; index += 1) {
      await prisma.$executeRaw`
        INSERT INTO "event_games"."participant_credentials" ("id", "event_id", "token_digest")
        VALUES (${credentialIds[index]}, ${eventId}, ${tokenDigests[index]})
      `;
      await prisma.$executeRaw`
        INSERT INTO "event_games"."session_participation_grants"
          ("id", "event_id", "session_id", "participant_credential_id", "entry_mode", "team_id", "team_label")
        VALUES (${grantIds[index]}, ${eventId}, ${sessionId}, ${credentialIds[index]}, 'active', ${teamId}, 'Blue Team')
      `;
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRaw`DELETE FROM "event_games"."active_pin_reservations" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."pin_history" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."moderation_actions" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."submissions" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."score_ledger" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."awards" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."session_participation_grants" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_sessions" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."participant_credentials" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_config_versions" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_definitions" WHERE "event_id" = ${eventId}`;
    await prisma.$disconnect();
  });

  it('serializes concurrent retries to one submission and one score ledger entry', async () => {
    if (!databaseUrl) return;
    const action = {
      eventId,
      sessionId,
      participationGrantId: grantIds[0],
      tokenDigest: tokenDigests[0],
      roundKey: 'round-1',
      roundNumber: 1,
      actionKind: 'answer',
      payload: { answer: 'B' },
      points: 10,
      isCorrect: true,
      deadlineAt: null,
      createdAt: now,
    } as const;
    const submit = () => prisma.$transaction((transaction) =>
      actionStore.recordParticipantAction(action, { prisma: transaction } as unknown as PrismTransactionContext));

    const results = await Promise.all([submit(), submit()]);
    const counts = await prisma.$queryRaw<Array<{ submissions: number; ledger_entries: number }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM "event_games"."submissions"
         WHERE "event_id" = ${eventId} AND "session_id" = ${sessionId}) AS "submissions",
        (SELECT COUNT(*)::integer FROM "event_games"."score_ledger"
         WHERE "event_id" = ${eventId} AND "session_id" = ${sessionId}) AS "ledger_entries"
    `;

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(counts[0]).toEqual({ submissions: 1, ledger_entries: 1 });
  });

  it('counts a team point award once, independent of active team size', async () => {
    if (!databaseUrl) return;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."score_ledger"
        ("id", "event_id", "session_id", "participation_grant_id", "source_event_id", "points", "reason", "created_at")
      VALUES (${randomUUID()}, ${eventId}, ${sessionId}, ${grantIds[1]}, ${`team-base:${randomUUID()}`}, 15, 'fixture', ${now})
    `;
    const awardInput: PrismAssignEventGameAwardInput = {
      idempotencyKey: '00000000-0000-4000-8000-000000000101',
      recipient: { type: 'team', teamId },
      awardKind: 'points',
      label: 'Team round bonus',
      points: 20,
    };
    const awardStore = new EventGamesAwardPrismaStoreAdapter();
    await expect(awardStore.assignAward({
      eventId, sessionId, actorId: 'p0-test', request: awardInput, now,
    }, { prisma } as unknown as PrismTransactionContext)).resolves.toMatchObject({
      recipientType: 'team', points: 20,
    });

    const result = await new EventGamesPrismaStoreAdapter().getHostState(
      { eventId, sessionId }, { prisma } as unknown as PrismTransactionContext,
    );

    expect(result?.leaderboard).toEqual([{
      rank: 1, label: 'Blue Team', score: 45, teamLabel: 'Blue Team',
      awardRecipient: { type: 'team', teamId },
    }]);
  });
});
