import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { prismEventGameKindSchema } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { GameParticipantGrantPersistenceError } from '../contracts/game-pin-store.port';
import type {
  GamePinCandidate,
  GamePinStorePort,
  GameSessionJoinResult,
  IssuedGamePinRecord,
  JoinableGameSessionRecord,
} from '../contracts/game-pin-store.port';

interface JoinableSessionRow {
  event_id: string;
  session_id: string;
  game_id: string;
  title: string;
  game_kind: string;
  entry_mode: string;
  status: string;
  expires_at: Date;
}

interface CredentialRow {
  id: string;
  revoked_at: Date | null;
}

interface JoinGrantRow {
  event_id: string;
  session_id: string;
  credential_id: string;
  token_digest: string;
  title: string;
  game_kind: string;
  status: string;
  grant_revoked_at: Date | null;
  credential_revoked_at: Date | null;
}

interface ActivePinRow {
  session_id: string;
  pin_digest: string;
  generation_attempt: number | null;
  expires_at: Date;
}

interface PinSessionScopeRow {
  entry_mode: string;
  status: string;
}

function sessionStatus(value: string): JoinableGameSessionRecord['status'] {
  if (['scheduled', 'lobby', 'live', 'paused', 'completed', 'cancelled'].includes(value)) {
    return value as JoinableGameSessionRecord['status'];
  }
  throw new Error(`Invalid persisted game session status: ${value}`);
}

function joinStatus(value: string): GameSessionJoinResult['status'] {
  if (value === 'lobby' || value === 'live') return value;
  throw new Error(`Invalid persisted joinable game session status: ${value}`);
}

@Injectable()
export class EventGamesPinPrismaStoreAdapter implements GamePinStorePort {
  async releaseExpiredReservations(
    input: { now: Date },
    transaction: PrismTransactionContext,
  ): Promise<number> {
    const rows = await transaction.prisma.$queryRaw<Array<{ released_count: bigint }>>`
      WITH expired AS (
        DELETE FROM "event_games"."active_pin_reservations"
        WHERE "expires_at" <= ${input.now}
        RETURNING "event_id", "session_id", "pin_digest"
      ), recorded AS (
        INSERT INTO "event_games"."pin_history"
          ("id", "event_id", "session_id", "pin_digest", "action", "actor_id", "created_at")
        SELECT gen_random_uuid()::text, "event_id", "session_id", "pin_digest", 'expired', 'system:expiry', ${input.now}
        FROM expired
        RETURNING "id"
      )
      SELECT COUNT(*) AS "released_count" FROM recorded
    `;
    return Number(rows[0]?.released_count ?? 0n);
  }

  async findActivePinByIdempotencyDigest(
    input: { eventId: string; sessionId: string; idempotencyKeyDigest: string; now: Date },
    transaction: PrismTransactionContext,
  ) {
    const rows = await transaction.prisma.$queryRaw<ActivePinRow[]>`
      SELECT "session_id", "pin_digest", "generation_attempt", "expires_at"
      FROM "event_games"."active_pin_reservations"
      WHERE "event_id" = ${input.eventId}
        AND "session_id" = ${input.sessionId}
        AND "issue_idempotency_key_digest" = ${input.idempotencyKeyDigest}
        AND "expires_at" > ${input.now}
      LIMIT 1
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row || row.generation_attempt === null) return null;
    return { pinDigest: row.pin_digest, generationAttempt: row.generation_attempt, expiresAt: row.expires_at, joinsWereEnabled: true };
  }

  async issueSessionPin(
    input: Parameters<GamePinStorePort['issueSessionPin']>[0],
    transaction: PrismTransactionContext,
  ): Promise<IssuedGamePinRecord | null> {
    await this.releaseExpiredReservations({ now: input.now }, transaction);
    this.validateCandidateCount(input);
    if (!(await this.isActiveSession(input, transaction))) return null;
    const prior = await this.findPriorIssue(input, transaction);
    if (prior !== undefined) return prior;
    this.validateIdempotencyDigest(input);
    const joinsWereEnabled = (await this.findCurrentReservation(input, transaction)).length > 0;
    this.validateCandidateDigests(input.candidates);
    await this.lockCandidateDigests(input.candidates, transaction);
    return this.reserveFirstAvailableCandidate(input, joinsWereEnabled, transaction);
  }

  private validateCandidateCount(input: Parameters<GamePinStorePort['issueSessionPin']>[0]) {
    if (input.candidates.length === 0 || input.candidates.length > 5) {
      throw new Error('Session PIN candidate count is invalid');
    }
  }

  private validateIdempotencyDigest(input: Parameters<GamePinStorePort['issueSessionPin']>[0]) {
    if (!/^[a-f0-9]{64}$/.test(input.idempotencyKeyDigest)) {
      throw new Error('Session PIN idempotency digest is invalid');
    }
  }

  private validateCandidateDigests(candidates: readonly GamePinCandidate[]) {
    for (const candidate of candidates) {
      if (!/^[a-f0-9]{64}$/.test(candidate.pinDigest) || !Number.isInteger(candidate.generationAttempt) || candidate.generationAttempt < 0) {
        throw new Error('Session PIN candidate is invalid');
      }
    }
  }

  private async isActiveSession(input: Parameters<GamePinStorePort['issueSessionPin']>[0], transaction: PrismTransactionContext) {
    const sessions = await transaction.prisma.$queryRaw<PinSessionScopeRow[]>`
      SELECT "entry_mode", "status"
      FROM "event_games"."game_sessions"
      WHERE "event_id" = ${input.eventId} AND "id" = ${input.sessionId}
      FOR UPDATE
    `;
    const session = sessions[0];
    return Boolean(session && session.entry_mode === 'active' && ['scheduled', 'lobby', 'live'].includes(session.status));
  }

  private async findPriorIssue(
    input: Parameters<GamePinStorePort['issueSessionPin']>[0],
    transaction: PrismTransactionContext,
  ): Promise<IssuedGamePinRecord | null | undefined> {
    const priorRequest = await transaction.prisma.$queryRaw<ActivePinRow[]>`
      SELECT "session_id", "pin_digest", "generation_attempt", "expires_at"
      FROM "event_games"."active_pin_reservations"
      WHERE "event_id" = ${input.eventId} AND "issue_idempotency_key_digest" = ${input.idempotencyKeyDigest}
      LIMIT 1
      FOR UPDATE
    `;
    const existing = priorRequest[0];
    if (!existing) return undefined;
    if (existing.session_id !== input.sessionId || existing.generation_attempt === null) return null;
    return {
      pinDigest: existing.pin_digest,
      generationAttempt: existing.generation_attempt,
      expiresAt: existing.expires_at,
      joinsWereEnabled: true,
    };
  }

  private findCurrentReservation(
    input: Parameters<GamePinStorePort['issueSessionPin']>[0],
    transaction: PrismTransactionContext,
  ) {
    return transaction.prisma.$queryRaw<ActivePinRow[]>`
      SELECT "session_id", "pin_digest", "generation_attempt", "expires_at"
      FROM "event_games"."active_pin_reservations"
      WHERE "event_id" = ${input.eventId} AND "session_id" = ${input.sessionId}
      LIMIT 1
      FOR UPDATE
    `;
  }

  private async lockCandidateDigests(candidates: readonly GamePinCandidate[], transaction: PrismTransactionContext) {
    for (const pinDigest of candidates.map(({ pinDigest }) => pinDigest).sort()) {
      await transaction.prisma.$queryRaw<Array<{ locked: boolean }>>`
        WITH lock_acquired AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(hashtextextended(${pinDigest}, 0))
        )
        SELECT TRUE AS "locked" FROM lock_acquired
      `;
    }
  }

  private async reserveFirstAvailableCandidate(
    input: Parameters<GamePinStorePort['issueSessionPin']>[0],
    joinsWereEnabled: boolean,
    transaction: PrismTransactionContext,
  ): Promise<IssuedGamePinRecord | null> {
    for (const candidate of input.candidates) {
      const collision = await transaction.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "event_games"."active_pin_reservations"
        WHERE "pin_digest" = ${candidate.pinDigest}
        LIMIT 1
        FOR UPDATE
      `;
      if (collision.length > 0) continue;
      await this.recordRotation(input, transaction);
      const issued = await this.insertPinReservation(input, candidate, transaction);
      const row = issued[0];
      if (!row) throw new Error('Session PIN reservation could not be persisted');
      return {
        pinDigest: row.pin_digest,
        generationAttempt: row.generation_attempt ?? candidate.generationAttempt,
        expiresAt: row.expires_at,
        joinsWereEnabled,
      };
    }
    return null;
  }

  private recordRotation(input: Parameters<GamePinStorePort['issueSessionPin']>[0], transaction: PrismTransactionContext) {
    return transaction.prisma.$queryRaw<Array<{ id: string }>>`
      WITH prior AS (
        DELETE FROM "event_games"."active_pin_reservations"
        WHERE "event_id" = ${input.eventId} AND "session_id" = ${input.sessionId}
        RETURNING "event_id", "session_id", "pin_digest"
      ), recorded AS (
        INSERT INTO "event_games"."pin_history"
          ("id", "event_id", "session_id", "pin_digest", "action", "actor_id", "created_at")
        SELECT gen_random_uuid()::text, "event_id", "session_id", "pin_digest", 'rotated', ${input.actorId}, ${input.now}
        FROM prior
        RETURNING "id"
      )
      SELECT "id" FROM recorded
    `;
  }

  private insertPinReservation(
    input: Parameters<GamePinStorePort['issueSessionPin']>[0],
    candidate: GamePinCandidate,
    transaction: PrismTransactionContext,
  ) {
    return transaction.prisma.$queryRaw<ActivePinRow[]>`
      WITH reserved AS (
        INSERT INTO "event_games"."active_pin_reservations"
          ("id", "event_id", "session_id", "pin_digest", "issue_idempotency_key_digest", "generation_attempt", "expires_at", "reserved_at")
        VALUES (
          ${randomUUID()}, ${input.eventId}, ${input.sessionId}, ${candidate.pinDigest},
          ${input.idempotencyKeyDigest}, ${candidate.generationAttempt}, ${input.expiresAt}, ${input.now}
        )
        RETURNING "event_id", "session_id", "pin_digest", "generation_attempt", "expires_at"
      ), recorded AS (
        INSERT INTO "event_games"."pin_history"
          ("id", "event_id", "session_id", "pin_digest", "action", "actor_id", "created_at")
        SELECT gen_random_uuid()::text, "event_id", "session_id", "pin_digest", 'issued', ${input.actorId}, ${input.now}
        FROM reserved
        RETURNING "id"
      )
      SELECT r."session_id", r."pin_digest", r."generation_attempt", r."expires_at"
      FROM reserved r CROSS JOIN recorded
    `;
  }

  async revokeSessionPin(
    input: { eventId: string; sessionId: string; actorId: string; now: Date; reason: 'revoked' | 'closed' },
    transaction: PrismTransactionContext,
  ): Promise<boolean | null> {
    const sessions = await transaction.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "event_games"."game_sessions"
      WHERE "event_id" = ${input.eventId} AND "id" = ${input.sessionId}
      FOR UPDATE
    `;
    if (!sessions[0]) return null;
    const rows = await transaction.prisma.$queryRaw<Array<{ revoked_count: bigint }>>`
      WITH revoked AS (
        DELETE FROM "event_games"."active_pin_reservations"
        WHERE "event_id" = ${input.eventId} AND "session_id" = ${input.sessionId}
        RETURNING "event_id", "session_id", "pin_digest"
      ), recorded AS (
        INSERT INTO "event_games"."pin_history"
          ("id", "event_id", "session_id", "pin_digest", "action", "actor_id", "created_at")
        SELECT gen_random_uuid()::text, "event_id", "session_id", "pin_digest", ${input.reason}, ${input.actorId}, ${input.now}
        FROM revoked
        RETURNING "id"
      )
      SELECT COUNT(*) AS "revoked_count" FROM recorded
    `;
    return Number(rows[0]?.revoked_count ?? 0n) > 0;
  }

  async findJoinableSessionByPinDigest(
    input: { pinDigest: string; now: Date },
    transaction: PrismTransactionContext,
  ): Promise<JoinableGameSessionRecord | null> {
    const rows = await transaction.prisma.$queryRaw<JoinableSessionRow[]>`
      SELECT s."event_id", s."id" AS "session_id", s."game_definition_id" AS "game_id",
        d."title", d."game_kind", d."entry_mode", s."status", r."expires_at"
      FROM "event_games"."active_pin_reservations" r
      JOIN "event_games"."game_sessions" s
        ON s."event_id" = r."event_id" AND s."id" = r."session_id"
      JOIN "event_games"."game_definitions" d
        ON d."event_id" = s."event_id" AND d."id" = s."game_definition_id"
      WHERE r."pin_digest" = ${input.pinDigest}
        AND r."expires_at" > ${input.now}
        AND s."entry_mode" = 'active'
        AND s."status" IN ('lobby', 'live')
        AND d."status" = 'published'
        AND d."archived_at" IS NULL
      FOR UPDATE OF r, s
    `;
    const row = rows[0];
    if (!row) return null;
    if (row.entry_mode !== 'active') throw new Error('Active PIN reservation references a non-active game');
    return {
      eventId: row.event_id,
      sessionId: row.session_id,
      gameId: row.game_id,
      title: row.title,
      kind: prismEventGameKindSchema.parse(row.game_kind),
      entryMode: 'active',
      status: sessionStatus(row.status),
      expiresAt: row.expires_at,
    };
  }

  async findActiveCredential(
    input: { eventId: string; tokenDigest: string },
    transaction: PrismTransactionContext,
  ): Promise<{ id: string } | null> {
    const rows = await transaction.prisma.$queryRaw<CredentialRow[]>`
      SELECT c."id", c."revoked_at"
      FROM "event_games"."participant_credentials" c
      WHERE c."event_id" = ${input.eventId}
        AND c."token_digest" = ${input.tokenDigest}
        AND c."revoked_at" IS NULL
      LIMIT 1
      FOR UPDATE
    `;
    return rows[0] ? { id: rows[0].id } : null;
  }

  async isParticipantAuthorized(
    input: { sessionId: string; tokenDigest: string },
    transaction: PrismTransactionContext,
  ): Promise<boolean> {
    const rows = await transaction.prisma.$queryRaw<Array<{ authorized: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM "event_games"."participant_credentials" c
        JOIN "event_games"."session_participation_grants" g
          ON g."event_id" = c."event_id"
          AND g."participant_credential_id" = c."id"
        JOIN "event_games"."game_sessions" s
          ON s."event_id" = g."event_id"
          AND s."id" = g."session_id"
        WHERE s."id" = ${input.sessionId}
          AND c."token_digest" = ${input.tokenDigest}
          AND c."revoked_at" IS NULL
          AND g."revoked_at" IS NULL
      ) AS "authorized"
    `;
    return rows[0]?.authorized === true;
  }

  async findJoinGrant(
    input: { eventId: string; idempotencyKeyDigest: string },
    transaction: PrismTransactionContext,
  ) {
    const rows = await transaction.prisma.$queryRaw<JoinGrantRow[]>`
      SELECT g."event_id", g."session_id", g."participant_credential_id" AS "credential_id",
        c."token_digest", d."title", d."game_kind", s."status",
        g."revoked_at" AS "grant_revoked_at", c."revoked_at" AS "credential_revoked_at"
      FROM "event_games"."session_participation_grants" g
      JOIN "event_games"."participant_credentials" c
        ON c."event_id" = g."event_id" AND c."id" = g."participant_credential_id"
      JOIN "event_games"."game_sessions" s
        ON s."event_id" = g."event_id" AND s."id" = g."session_id"
      JOIN "event_games"."game_definitions" d
        ON d."event_id" = s."event_id" AND d."id" = s."game_definition_id"
      WHERE g."event_id" = ${input.eventId}
        AND g."join_idempotency_key_digest" = ${input.idempotencyKeyDigest}
      LIMIT 1
      FOR UPDATE OF g, c
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      eventId: row.event_id,
      sessionId: row.session_id,
      credentialId: row.credential_id,
      tokenDigest: row.token_digest,
      title: row.title,
      kind: prismEventGameKindSchema.parse(row.game_kind),
      status: joinStatus(row.status),
      active: row.grant_revoked_at === null && row.credential_revoked_at === null,
    };
  }

  async createParticipantGrant(
    input: {
      eventId: string;
      sessionId: string;
      gameId: string;
      credentialId: string;
      tokenDigest: string;
      idempotencyKeyDigest: string;
      createCredential: boolean;
      now: Date;
    },
    transaction: PrismTransactionContext,
  ): Promise<GameSessionJoinResult | null> {
    if (input.createCredential) {
      await transaction.prisma.$executeRaw`
        INSERT INTO "event_games"."participant_credentials" ("id", "event_id", "token_digest", "created_at")
        VALUES (${input.credentialId}, ${input.eventId}, ${input.tokenDigest}, ${input.now})
        ON CONFLICT ("token_digest") DO NOTHING
      `;
    }

    const credentialRows = await transaction.prisma.$queryRaw<CredentialRow[]>`
      SELECT c."id", c."revoked_at"
      FROM "event_games"."participant_credentials" c
      WHERE c."event_id" = ${input.eventId}
        AND c."token_digest" = ${input.tokenDigest}
        AND c."revoked_at" IS NULL
      LIMIT 1
      FOR UPDATE
    `;
    const credential = credentialRows[0];
    if (!credential || (!input.createCredential && credential.id !== input.credentialId)) return null;

    await transaction.prisma.$executeRaw`
      INSERT INTO "event_games"."session_participation_grants"
        ("id", "event_id", "session_id", "participant_credential_id", "join_idempotency_key_digest", "entry_mode", "granted_at")
      VALUES (${randomUUID()}, ${input.eventId}, ${input.sessionId}, ${credential.id}, ${input.idempotencyKeyDigest}, 'pin', ${input.now})
      ON CONFLICT DO NOTHING
    `;

    const grantRows = await transaction.prisma.$queryRaw<JoinGrantRow[]>`
      SELECT g."event_id", g."session_id", g."participant_credential_id" AS "credential_id",
        c."token_digest", d."title", d."game_kind", s."status",
        g."revoked_at" AS "grant_revoked_at", c."revoked_at" AS "credential_revoked_at"
      FROM "event_games"."session_participation_grants" g
      JOIN "event_games"."participant_credentials" c
        ON c."event_id" = g."event_id" AND c."id" = g."participant_credential_id"
      JOIN "event_games"."game_sessions" s
        ON s."event_id" = g."event_id" AND s."id" = g."session_id"
      JOIN "event_games"."game_definitions" d
        ON d."event_id" = s."event_id" AND d."id" = s."game_definition_id"
      WHERE g."event_id" = ${input.eventId}
        AND (
          g."join_idempotency_key_digest" = ${input.idempotencyKeyDigest}
          OR (g."session_id" = ${input.sessionId} AND g."participant_credential_id" = ${credential.id})
        )
      ORDER BY CASE WHEN g."join_idempotency_key_digest" = ${input.idempotencyKeyDigest} THEN 0 ELSE 1 END
      LIMIT 1
      FOR UPDATE OF g, c
    `;
    const grant = grantRows[0];
    if (!grant || grant.session_id !== input.sessionId || grant.token_digest !== input.tokenDigest || grant.grant_revoked_at || grant.credential_revoked_at) {
      throw new GameParticipantGrantPersistenceError();
    }
    return {
      sessionId: grant.session_id,
      title: grant.title,
      kind: prismEventGameKindSchema.parse(grant.game_kind),
      status: joinStatus(grant.status),
    };
  }
}
