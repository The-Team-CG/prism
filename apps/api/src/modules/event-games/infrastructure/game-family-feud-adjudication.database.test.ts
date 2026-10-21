import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventGamesModerationPrismaStoreAdapter } from './event-games-moderation-prisma-store.adapter';
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

databaseSuite('Family Feud host adjudication PostgreSQL invariants', () => {
  let prisma: PrismaService;
  const eventId = randomUUID();
  const definitionId = randomUUID();
  const configVersionId = randomUUID();
  const sessionId = randomUUID();
  const credentialId = randomUUID();
  const grantId = randomUUID();
  const teamId = randomUUID();
  const submissionId = randomUUID();
  const now = new Date('2026-10-17T10:00:00.000Z');
  const configuration = {
    kind: 'family-feud',
    teams: [
      { id: randomUUID(), label: 'Blue' },
      { id: randomUUID(), label: 'Gold' },
    ],
    rounds: [{ key: 'round-1', prompt: 'Name a popular fruit.', durationSeconds: 30,
      answers: [{ answer: 'Mango', alternatives: ['Mangga'], points: 10 }] }],
  };
  const moderationStore = new EventGamesModerationPrismaStoreAdapter();

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
      VALUES (${definitionId}, ${eventId}, ${definitionId}, 'Family Feud adjudication test', 'family-feud', 'active', 'published', 'p0-test', ${now})
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_config_versions"
        ("id", "game_definition_id", "event_id", "version", "config", "created_by")
      VALUES (${configVersionId}, ${definitionId}, ${eventId}, 1, ${JSON.stringify({ configuration })}::jsonb, 'p0-test')
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_sessions"
        ("id", "event_id", "game_definition_id", "config_version_id", "config_snapshot", "entry_mode",
         "status", "started_at", "created_by", "start_idempotency_key", "updated_at")
      VALUES (${sessionId}, ${eventId}, ${definitionId}, ${configVersionId}, ${JSON.stringify({ configuration })}::jsonb, 'active',
        'live', ${now}, 'p0-test', ${sessionId}, ${now})
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."participant_credentials" ("id", "event_id", "token_digest")
      VALUES (${credentialId}, ${eventId}, ${`sha256:${randomUUID()}`})
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."session_participation_grants"
        ("id", "event_id", "session_id", "participant_credential_id", "entry_mode", "team_id", "team_label")
      VALUES (${grantId}, ${eventId}, ${sessionId}, ${credentialId}, 'active', ${teamId}, 'Blue Team')
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."submissions"
        ("id", "event_id", "session_id", "participation_grant_id", "round_key", "round_number", "action_kind", "payload", "score_result", "created_at")
      VALUES (${submissionId}, ${eventId}, ${sessionId}, ${grantId}, 'round-1', 1, 'answer',
        '{"answer":"Mangga"}'::jsonb, '{"points":0,"isCorrect":false}'::jsonb, ${now})
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."score_ledger"
        ("id", "event_id", "session_id", "participation_grant_id", "source_event_id", "points", "reason", "created_at")
      VALUES (${randomUUID()}, ${eventId}, ${sessionId}, ${grantId}, ${submissionId}, 0, 'answer', ${now})
    `;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRaw`DELETE FROM "event_games"."moderation_actions" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."submissions" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."score_ledger" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."session_participation_grants" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_sessions" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."participant_credentials" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_config_versions" WHERE "event_id" = ${eventId}`;
    await prisma.$executeRaw`DELETE FROM "event_games"."game_definitions" WHERE "event_id" = ${eventId}`;
    await prisma.$disconnect();
  });

  it('applies the configured team score once and retains the selected answer for audit', async () => {
    if (!databaseUrl) return;
    const request = {
      action: 'resolve_family_feud_answer' as const,
      idempotencyKey: randomUUID(),
      submissionId,
      boardAnswer: 'Mango',
    };
    const apply = (input = request, actorId = 'p0-host') => prisma.$transaction((transaction) =>
      moderationStore.applyModeration({
        eventId, sessionId, actorId, request: input, now,
      }, { prisma: transaction } as unknown as PrismTransactionContext));

    await expect(apply()).resolves.toMatchObject({ afterStatus: 'visible', targetId: submissionId });
    await expect(apply()).resolves.toMatchObject({ afterStatus: 'visible', targetId: submissionId });
    await expect(apply({ ...request, idempotencyKey: randomUUID() }, 'second-host')).resolves.toBeNull();

    const submission = await prisma.$queryRaw<Array<{ score_result: unknown }>>`
      SELECT "score_result" FROM "event_games"."submissions"
      WHERE "event_id" = ${eventId} AND "session_id" = ${sessionId} AND "id" = ${submissionId}
    `;
    const ledger = await prisma.$queryRaw<Array<{ points: number }>>`
      SELECT "points" FROM "event_games"."score_ledger"
      WHERE "event_id" = ${eventId} AND "session_id" = ${sessionId} AND "source_event_id" = ${submissionId}
    `;
    const moderation = await prisma.$queryRaw<Array<{ action: string; resolved_answer: string | null }>>`
      SELECT "action", "resolved_answer" FROM "event_games"."moderation_actions"
      WHERE "event_id" = ${eventId} AND "session_id" = ${sessionId} AND "submission_id" = ${submissionId}
    `;
    expect(submission[0]?.score_result).toEqual({ points: 10, isCorrect: true });
    expect(ledger).toEqual([{ points: 10 }]);
    expect(moderation).toEqual([{ action: 'resolve_family_feud_answer', resolved_answer: 'Mango' }]);

    const hostState = await new EventGamesPrismaStoreAdapter().getHostState(
      { eventId, sessionId }, { prisma } as unknown as PrismTransactionContext,
    );
    expect(hostState?.leaderboard).toMatchObject([{ teamLabel: 'Blue Team', score: 10 }]);
  });
});
