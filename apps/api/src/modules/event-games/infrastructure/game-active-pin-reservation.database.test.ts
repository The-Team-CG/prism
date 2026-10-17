import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { PrismTransactionRunner, type PrismTransactionContext } from '@prism/kernel/shared-kernel';
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

databaseSuite('Event games active PIN reservation PostgreSQL invariants', () => {
  let prisma: PrismaService;
  const eventId = randomUUID();
  const foreignEventId = randomUUID();
  const definitionId = randomUUID();
  const foreignDefinitionId = randomUUID();
  const siblingDefinitionId = randomUUID();
  const configVersionId = randomUUID();
  const foreignConfigVersionId = randomUUID();
  const siblingConfigVersionId = randomUUID();
  const participantCredentialId = randomUUID();
  const participantTokenDigest = `sha256:${randomUUID()}`;
  const foreignParticipantCredentialId = randomUUID();

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
        ${definitionId}, ${eventId}, ${definitionId}, 'PIN reservation test', 'live-trivia', 'active', 'published', 'p0-test', NOW(), NOW()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_config_versions" (
        "id", "game_definition_id", "event_id", "version", "config", "created_by", "created_at"
      ) VALUES (
        ${configVersionId}, ${definitionId}, ${eventId}, 1, '{}'::jsonb, 'p0-test', NOW()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_definitions" (
        "id", "event_id", "slug", "title", "game_kind", "entry_mode", "status", "created_by", "created_at", "updated_at"
      ) VALUES (
        ${foreignDefinitionId}, ${foreignEventId}, ${foreignDefinitionId}, 'Foreign event test', 'live-trivia', 'active', 'draft', 'p0-test', NOW(), NOW()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_config_versions" (
        "id", "game_definition_id", "event_id", "version", "config", "created_by", "created_at"
      ) VALUES (
        ${foreignConfigVersionId}, ${foreignDefinitionId}, ${foreignEventId}, 1, '{}'::jsonb, 'p0-test', NOW()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_definitions" (
        "id", "event_id", "slug", "title", "game_kind", "entry_mode", "status", "created_by", "created_at", "updated_at"
      ) VALUES (
        ${siblingDefinitionId}, ${eventId}, ${siblingDefinitionId}, 'Sibling event game', 'live-trivia', 'active', 'draft', 'p0-test', NOW(), NOW()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_config_versions" (
        "id", "game_definition_id", "event_id", "version", "config", "created_by", "created_at"
      ) VALUES (
        ${siblingConfigVersionId}, ${siblingDefinitionId}, ${eventId}, 1, '{}'::jsonb, 'p0-test', NOW()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."participant_credentials" ("id", "event_id", "token_digest", "created_at")
      VALUES (${participantCredentialId}, ${eventId}, ${participantTokenDigest}, NOW())
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."participant_credentials" ("id", "event_id", "token_digest", "created_at")
      VALUES (${foreignParticipantCredentialId}, ${foreignEventId}, ${`sha256:${randomUUID()}`}, NOW())
    `;
  });

  afterAll(async () => {
    if (prisma) {
      const eventIdA = eventId;
      const eventIdB = foreignEventId;
      await prisma.$executeRaw`DELETE FROM "event_games"."active_pin_reservations" WHERE "event_id" IN (${eventIdA}, ${eventIdB})`;
      await prisma.$executeRaw`DELETE FROM "event_games"."pin_history" WHERE "event_id" IN (${eventIdA}, ${eventIdB})`;
      await prisma.$executeRaw`DELETE FROM "event_games"."moderation_actions" WHERE "event_id" IN (${eventIdA}, ${eventIdB})`;
      await prisma.$executeRaw`DELETE FROM "event_games"."submissions" WHERE "event_id" IN (${eventIdA}, ${eventIdB})`;
      await prisma.$executeRaw`DELETE FROM "event_games"."score_ledger" WHERE "event_id" IN (${eventIdA}, ${eventIdB})`;
      await prisma.$executeRaw`DELETE FROM "event_games"."awards" WHERE "event_id" IN (${eventIdA}, ${eventIdB})`;
      await prisma.$executeRaw`DELETE FROM "event_games"."session_participation_grants" WHERE "event_id" IN (${eventIdA}, ${eventIdB})`;
      await prisma.$executeRaw`DELETE FROM "event_games"."game_sessions" WHERE "event_id" IN (${eventIdA}, ${eventIdB})`;
      await prisma.$executeRaw`DELETE FROM "event_games"."participant_credentials" WHERE "event_id" IN (${eventIdA}, ${eventIdB})`;
      await prisma.$executeRaw`DELETE FROM "event_games"."game_config_versions" WHERE "event_id" IN (${eventIdA}, ${eventIdB})`;
      await prisma.$executeRaw`DELETE FROM "event_games"."game_definitions" WHERE "event_id" IN (${eventIdA}, ${eventIdB})`;
      await prisma.$disconnect();
    }
  });

  async function createSession(
    sessionEventId = eventId,
    sessionDefinitionId = definitionId,
    sessionConfigVersionId = configVersionId,
  ) {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "event_games"."game_sessions" (
        "id", "event_id", "game_definition_id", "config_version_id", "config_snapshot", "entry_mode", "status", "created_by", "start_idempotency_key", "created_at", "updated_at"
      ) VALUES (
        ${id}, ${sessionEventId}, ${sessionDefinitionId}, ${sessionConfigVersionId}, '{}'::jsonb, 'active', 'scheduled', 'p0-test', ${id}, NOW(), NOW()
      )
    `;
    return id;
  }

  async function reserve(sessionId: string, pinDigest: string, reservationEventId = eventId) {
    await prisma.$executeRaw`
      INSERT INTO "event_games"."active_pin_reservations" (
        "id", "event_id", "session_id", "pin_digest", "expires_at", "reserved_at"
      ) VALUES (
        ${randomUUID()}, ${reservationEventId}, ${sessionId}, ${pinDigest}, NOW() + INTERVAL '1 hour', NOW()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "event_games"."pin_history" (
        "id", "event_id", "session_id", "pin_digest", "action", "actor_id", "created_at"
      ) VALUES (
        ${randomUUID()}, ${reservationEventId}, ${sessionId}, ${pinDigest}, 'issued', 'p0-test', NOW()
      )
    `;
  }

  async function createGrant(
    sessionId: string,
    grantEventId = eventId,
    credentialId = participantCredentialId,
    joinKeyDigest: string | null = null,
  ) {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "event_games"."session_participation_grants" (
        "id", "event_id", "session_id", "participant_credential_id", "join_idempotency_key_digest", "entry_mode", "granted_at"
      ) VALUES (
        ${id}, ${grantEventId}, ${sessionId}, ${credentialId}, ${joinKeyDigest}, 'pin', NOW()
      )
    `;
    return id;
  }

  it('rejects cross-event config, session, credential, and grant references', async () => {
    await expect(createSession(eventId, definitionId, foreignConfigVersionId)).rejects.toThrow();
    await expect(createSession(eventId, definitionId, siblingConfigVersionId)).rejects.toThrow();

    const sessionId = await createSession();
    await expect(reserve(sessionId, `sha256:${randomUUID()}`, foreignEventId)).rejects.toThrow();
    await expect(createGrant(sessionId, eventId, foreignParticipantCredentialId)).rejects.toThrow();

    const grantId = await createGrant(sessionId);
    await expect(prisma.$executeRaw`
      INSERT INTO "event_games"."submissions" (
        "id", "event_id", "session_id", "participation_grant_id", "round_key", "action_kind", "payload", "created_at"
      ) VALUES (
        ${randomUUID()}, ${foreignEventId}, ${sessionId}, ${grantId}, 'round-1', 'answer', '{}'::jsonb, NOW()
      )
    `).rejects.toThrow();
  });

  it('reuses an existing same-session credential grant on a new join idempotency key', async () => {
    const sessionId = await createSession();
    await prisma.$executeRaw`
      UPDATE "event_games"."game_sessions" SET "status" = 'lobby' WHERE "event_id" = ${eventId} AND "id" = ${sessionId}
    `;
    await createGrant(sessionId, eventId, participantCredentialId, `old-${randomUUID()}`);
    const store = new EventGamesPinPrismaStoreAdapter();
    const transactions = new PrismTransactionRunner(prisma);

    const result = await transactions.run((transaction) => store.createParticipantGrant({
      eventId,
      sessionId,
      gameId: definitionId,
      credentialId: participantCredentialId,
      tokenDigest: participantTokenDigest,
      idempotencyKeyDigest: `new-${randomUUID()}`,
      createCredential: false,
      now: new Date(),
    }, transaction), { actorId: 'p0-test' });

    expect(result).toMatchObject({ sessionId, title: 'PIN reservation test', kind: 'live-trivia', status: 'lobby' });
    const grants = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM "event_games"."session_participation_grants"
      WHERE "event_id" = ${eventId} AND "session_id" = ${sessionId} AND "participant_credential_id" = ${participantCredentialId}
    `;
    expect(Number(grants[0]?.count)).toBe(1);
  });

  it('supports team awards and moderation against a participant before a submission exists', async () => {
    const sessionId = await createSession();
    const grantId = await createGrant(sessionId);

    await expect(prisma.$executeRaw`
      INSERT INTO "event_games"."awards" (
        "id", "event_id", "session_id", "recipient_type", "recipient_key", "participation_grant_id", "team_id",
        "award_kind", "label", "assigned_by", "source_event_id", "created_at"
      ) VALUES (
        ${randomUUID()}, ${eventId}, ${sessionId}, 'team', 'team:blue', NULL, 'blue',
        'badge', 'Blue team', 'p0-test', ${randomUUID()}, NOW()
      )
    `).resolves.toBeDefined();
    await expect(prisma.$executeRaw`
      INSERT INTO "event_games"."awards" (
        "id", "event_id", "session_id", "recipient_type", "recipient_key", "participation_grant_id", "team_id",
        "award_kind", "label", "assigned_by", "source_event_id", "created_at"
      ) VALUES (
        ${randomUUID()}, ${eventId}, ${randomUUID()}, 'team', 'team:blue', NULL, 'blue',
        'badge', 'Unknown session', 'p0-test', ${randomUUID()}, NOW()
      )
    `).rejects.toThrow();
    await expect(prisma.$executeRaw`
      INSERT INTO "event_games"."awards" (
        "id", "event_id", "session_id", "recipient_type", "recipient_key", "participation_grant_id", "team_id",
        "award_kind", "label", "assigned_by", "source_event_id", "created_at"
      ) VALUES (
        ${randomUUID()}, ${foreignEventId}, ${sessionId}, 'team', 'team:blue', NULL, 'blue',
        'badge', 'Wrong event', 'p0-test', ${randomUUID()}, NOW()
      )
    `).rejects.toThrow();
    await expect(prisma.$executeRaw`
      INSERT INTO "event_games"."awards" (
        "id", "event_id", "session_id", "recipient_type", "recipient_key", "participation_grant_id", "team_id",
        "award_kind", "label", "assigned_by", "source_event_id", "created_at"
      ) VALUES (
        ${randomUUID()}, ${eventId}, ${sessionId}, 'team', 'team:blue', ${grantId}, 'blue',
        'badge', 'Invalid mixed recipient', 'p0-test', ${randomUUID()}, NOW()
      )
    `).rejects.toThrow();

    await expect(prisma.$executeRaw`
      INSERT INTO "event_games"."moderation_actions" (
        "id", "event_id", "session_id", "submission_id", "participation_grant_id", "action", "actor_id", "created_at"
      ) VALUES (
        ${randomUUID()}, ${eventId}, ${sessionId}, NULL, ${grantId}, 'hide-participant', 'p0-test', NOW()
      )
    `).resolves.toBeDefined();
    await expect(prisma.$executeRaw`
      INSERT INTO "event_games"."moderation_actions" (
        "id", "event_id", "session_id", "submission_id", "participation_grant_id", "action", "actor_id", "created_at"
      ) VALUES (
        ${randomUUID()}, ${eventId}, ${sessionId}, NULL, NULL, 'hide-participant', 'p0-test', NOW()
      )
    `).rejects.toThrow();

    const submissionId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "event_games"."submissions" (
        "id", "event_id", "session_id", "participation_grant_id", "round_key", "action_kind", "payload", "created_at"
      ) VALUES (
        ${submissionId}, ${eventId}, ${sessionId}, ${grantId}, 'round-1', 'answer', '{}'::jsonb, NOW()
      )
    `;
    await expect(prisma.$executeRaw`
      INSERT INTO "event_games"."moderation_actions" (
        "id", "event_id", "session_id", "submission_id", "participation_grant_id", "action", "actor_id", "created_at"
      ) VALUES (
        ${randomUUID()}, ${eventId}, ${sessionId}, ${submissionId}, ${grantId}, 'hide-participant', 'p0-test', NOW()
      )
    `).rejects.toThrow();
  });

  it('serializes duplicate active PIN digests and releases only the rotated session reservation', async () => {
    const raceDigest = `sha256:${randomUUID()}`;
    const [raceSessionA, raceSessionB] = await Promise.all([createSession(), createSession()]);
    const raceResults = await Promise.allSettled([
      reserve(raceSessionA, raceDigest),
      reserve(raceSessionB, raceDigest),
    ]);

    expect(raceResults.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(raceResults.filter(({ status }) => status === 'rejected')).toHaveLength(1);

    await prisma.$executeRaw`
      DELETE FROM "event_games"."active_pin_reservations" WHERE "pin_digest" = ${raceDigest}
    `;

    const [rotatingSession, untouchedSession, replacementSession] = await Promise.all([
      createSession(),
      createSession(),
      createSession(),
    ]);
    const replacedDigest = `sha256:${randomUUID()}`;
    const untouchedDigest = `sha256:${randomUUID()}`;
    const replacementDigest = `sha256:${randomUUID()}`;

    await reserve(rotatingSession, replacedDigest);
    await reserve(untouchedSession, untouchedDigest);
    await prisma.$executeRaw`
      DELETE FROM "event_games"."active_pin_reservations" WHERE "session_id" = ${rotatingSession}
    `;
    await reserve(rotatingSession, replacementDigest);

    await expect(reserve(replacementSession, replacedDigest)).resolves.toBeUndefined();
    await expect(reserve(replacementSession, untouchedDigest)).rejects.toThrow();

    const history = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM "event_games"."pin_history"
      WHERE "session_id" = ${rotatingSession} AND "pin_digest" = ${replacedDigest}
    `;
    expect(Number(history[0]?.count)).toBe(1);
    await expect(prisma.$executeRaw`
      DELETE FROM "event_games"."game_sessions" WHERE "id" = ${rotatingSession}
    `).rejects.toThrow();
    const retainedHistory = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM "event_games"."pin_history" WHERE "session_id" = ${rotatingSession}
    `;
    expect(Number(retainedHistory[0]?.count)).toBe(2);
  });

  it('reclaims an expired digest for a new reservation while preserving expiry history', async () => {
    const expiredSession = await createSession();
    const replacementSession = await createSession();
    const reusableDigest = `sha256:${randomUUID()}`;
    await reserve(expiredSession, reusableDigest);
    const databaseClock = await prisma.$queryRaw<Array<{ now: Date }>>`
      SELECT NOW() + INTERVAL '1 second' AS "now"
    `;
    const now = databaseClock[0]!.now;
    const expiredAt = new Date(now.getTime() - 60_000);
    await prisma.$executeRaw`
      UPDATE "event_games"."active_pin_reservations"
      SET "expires_at" = ${expiredAt}
      WHERE "session_id" = ${expiredSession}
    `;

    const store = new EventGamesPinPrismaStoreAdapter();
    const transactions = new PrismTransactionRunner(prisma);
    await expect(transactions.run(
      (transaction) => store.releaseExpiredReservations({ now }, transaction),
      { actorId: 'system:expiry' },
    )).resolves.toBe(1);

    await expect(reserve(replacementSession, reusableDigest)).resolves.toBeUndefined();
    const history = await prisma.$queryRaw<Array<{ action: string }>>`
      SELECT "action" FROM "event_games"."pin_history"
      WHERE "session_id" = ${expiredSession} AND "pin_digest" = ${reusableDigest}
      ORDER BY "created_at" ASC
    `;
    expect(history.map(({ action }) => action)).toEqual(['issued', 'expired']);

    const currentReservation = await prisma.$queryRaw<Array<{ session_id: string }>>`
      SELECT "session_id" FROM "event_games"."active_pin_reservations"
      WHERE "pin_digest" = ${reusableDigest}
    `;
    expect(currentReservation).toEqual([{ session_id: replacementSession }]);
  });

  it('production PIN store retries a collision, rotates, resolves active PINs, and revokes with history', async () => {
    const sessionId = await createSession();
    const collisionSessionId = await createSession();
    await prisma.$executeRaw`
      UPDATE "event_games"."game_sessions" SET "status" = 'lobby'
      WHERE "event_id" = ${eventId} AND "id" IN (${sessionId}, ${collisionSessionId})
    `;
    const collisionDigest = randomUUID().replaceAll('-', '').padEnd(64, '0').slice(0, 64);
    const firstDigest = randomUUID().replaceAll('-', '').padEnd(64, '1').slice(0, 64);
    const rotatedDigest = randomUUID().replaceAll('-', '').padEnd(64, '2').slice(0, 64);
    const firstIssueKeyDigest = randomUUID().replaceAll('-', '').padEnd(64, '3').slice(0, 64);
    const rotateIssueKeyDigest = randomUUID().replaceAll('-', '').padEnd(64, '4').slice(0, 64);
    await reserve(collisionSessionId, collisionDigest);

    const store = new EventGamesPinPrismaStoreAdapter();
    const transactions = new PrismTransactionRunner(prisma);
    const now = new Date('2026-10-16T12:00:00.000Z');
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const run = <T>(work: (transaction: PrismTransactionContext) => Promise<T>) =>
      transactions.run(work, { actorId: 'p0-test' });

    const issued = await run((transaction) => store.issueSessionPin({
      eventId, sessionId, idempotencyKeyDigest: firstIssueKeyDigest,
      candidates: [
        { pinDigest: collisionDigest, generationAttempt: 0 },
        { pinDigest: firstDigest, generationAttempt: 1 },
      ],
      expiresAt, now, actorId: 'p0-test',
    }, transaction));
    expect(issued).toMatchObject({ pinDigest: firstDigest, generationAttempt: 1, expiresAt, joinsWereEnabled: false });

    const active = await run((transaction) => store.findActivePinByIdempotencyDigest({
      eventId, sessionId, idempotencyKeyDigest: firstIssueKeyDigest, now,
    }, transaction));
    expect(active).toMatchObject({ pinDigest: firstDigest, generationAttempt: 1, expiresAt });
    const joinable = await run((transaction) => store.findJoinableSessionByPinDigest({ pinDigest: firstDigest, now }, transaction));
    expect(joinable).toMatchObject({ eventId, sessionId, entryMode: 'active', status: 'lobby' });

    const rotatedAt = new Date(now.getTime() + 1_000);
    const rotatedExpiry = new Date(rotatedAt.getTime() + 24 * 60 * 60 * 1000);
    const rotated = await run((transaction) => store.issueSessionPin({
      eventId, sessionId, idempotencyKeyDigest: rotateIssueKeyDigest,
      candidates: [{ pinDigest: rotatedDigest, generationAttempt: 0 }],
      expiresAt: rotatedExpiry, now: rotatedAt, actorId: 'p0-test',
    }, transaction));
    expect(rotated).toMatchObject({ pinDigest: rotatedDigest, generationAttempt: 0, joinsWereEnabled: true });

    await expect(run((transaction) => store.revokeSessionPin({
      eventId, sessionId, actorId: 'p0-test', now: new Date(now.getTime() + 2_000), reason: 'revoked',
    }, transaction))).resolves.toBe(true);
    await expect(run((transaction) => store.findJoinableSessionByPinDigest({ pinDigest: rotatedDigest, now }, transaction))).resolves.toBeNull();
    const revokedAt = new Date(now.getTime() + 2_000);
    const history = await prisma.$queryRaw<Array<{ action: string; pin_digest: string; created_at: Date }>>`
      SELECT "action", "pin_digest", "created_at" FROM "event_games"."pin_history"
      WHERE "event_id" = ${eventId} AND "session_id" = ${sessionId}
      ORDER BY "created_at" ASC
    `;
    const historyByTime = new Map<number, Array<{ action: string; pin_digest: string }>>();
    for (const { action, pin_digest, created_at } of history) {
      const timestamp = created_at.getTime();
      const entries = historyByTime.get(timestamp) ?? [];
      entries.push({ action, pin_digest });
      historyByTime.set(timestamp, entries);
    }
    expect([...historyByTime.entries()].map(([timestamp, entries]) => ({
      timestamp,
      entries: entries.sort((a, b) => a.action.localeCompare(b.action)),
    }))).toEqual([
      { timestamp: now.getTime(), entries: [{ action: 'issued', pin_digest: firstDigest }] },
      {
        timestamp: rotatedAt.getTime(),
        entries: [
          { action: 'issued', pin_digest: rotatedDigest },
          { action: 'rotated', pin_digest: firstDigest },
        ],
      },
      { timestamp: revokedAt.getTime(), entries: [{ action: 'revoked', pin_digest: rotatedDigest }] },
    ]);
  });
});
