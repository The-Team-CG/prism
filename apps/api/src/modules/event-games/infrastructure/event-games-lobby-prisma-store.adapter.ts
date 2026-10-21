import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prismEventGameBrandThemeSchema, prismEventGameKindSchema } from '@prism/types';
import { z } from 'zod';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type {
  CreateIndependentGameSessionRecord,
  ExistingIndependentGameStartRecord,
  GameLobbyStorePort,
  IndependentGameSessionRecord,
  PublicIndependentGameRecord,
} from '../contracts/game-lobby-store.port';

const jsonRecordSchema = z.record(z.string(), z.unknown());

interface LobbySlugRow { event_id: string; lobby_slug: string }
interface PublicGameRow {
  id: string;
  title: string;
  game_kind: string;
  status: string;
  entry_mode: string;
  available_from: Date | null;
  available_until: Date | null;
}
interface IndependentGameRow extends PublicGameRow {
  event_id: string;
  config_version_id: string;
  config: unknown;
  archived_at: Date | null;
}
interface SessionRow {
  id: string;
  event_id: string;
  game_definition_id: string;
  status: string;
  title: string;
  game_kind: string;
  participant_credential_id: string | null;
  token_digest: string | null;
}

function publicGame(row: PublicGameRow): PublicIndependentGameRecord {
  return {
    id: row.id,
    title: row.title,
    kind: prismEventGameKindSchema.parse(row.game_kind),
    status: row.status,
    entryMode: row.entry_mode,
    availableFrom: row.available_from,
    availableUntil: row.available_until,
  };
}

@Injectable()
export class EventGamesLobbyPrismaStoreAdapter implements GameLobbyStorePort {
  async findEventIdForLobbySlug(eventSlug: string, transaction: PrismTransactionContext): Promise<string | null> {
    const rows = await transaction.prisma.$queryRaw<LobbySlugRow[]>`
      SELECT "event_id", "lobby_slug" FROM "event_games"."lobby_slugs"
      WHERE "lobby_slug" = ${eventSlug}
      LIMIT 1
    `;
    return rows[0]?.event_id ?? null;
  }

  async findLobbyBranding(eventId: string, transaction: PrismTransactionContext) {
    const rows = await transaction.prisma.$queryRaw<Array<{
      brand_theme: string;
      brand_primary_color: string | null;
      brand_secondary_color: string | null;
      brand_logo_object_id: string | null;
    }>>`
      SELECT "brand_theme", "brand_primary_color", "brand_secondary_color", "brand_logo_object_id"
      FROM "event_games"."lobby_slugs"
      WHERE "event_id" = ${eventId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      theme: prismEventGameBrandThemeSchema.parse(row.brand_theme),
      primaryColor: row.brand_primary_color,
      secondaryColor: row.brand_secondary_color,
      logoObjectId: row.brand_logo_object_id,
    };
  }

  async listPublicIndependentGames(eventId: string, transaction: PrismTransactionContext): Promise<PublicIndependentGameRecord[]> {
    const rows = await transaction.prisma.$queryRaw<PublicGameRow[]>`
      SELECT "id", "title", "game_kind", "status", "entry_mode", "available_from", "available_until"
      FROM "event_games"."game_definitions"
      WHERE "event_id" = ${eventId} AND "entry_mode" = 'independent'
        AND "status" = 'published' AND "archived_at" IS NULL
        AND ("available_from" IS NULL OR "available_from" <= NOW())
        AND ("available_until" IS NULL OR NOW() < "available_until")
      ORDER BY "created_at", "id"
    `;
    return rows.map(publicGame);
  }

  async findPublishedIndependentGame(
    scope: { eventId: string; gameId: string },
    transaction: PrismTransactionContext,
  ): Promise<PublicIndependentGameRecord | null> {
    const rows = await transaction.prisma.$queryRaw<IndependentGameRow[]>`
      SELECT d."id", d."event_id", d."title", d."game_kind", d."status", d."entry_mode",
        d."available_from", d."available_until", d."archived_at",
        v."id" AS "config_version_id", v."config"
      FROM "event_games"."game_definitions" d
      JOIN LATERAL (
        SELECT cv."id", cv."config" FROM "event_games"."game_config_versions" cv
        WHERE cv."event_id" = d."event_id" AND cv."game_definition_id" = d."id"
        ORDER BY cv."version" DESC LIMIT 1
      ) v ON TRUE
      WHERE d."event_id" = ${scope.eventId} AND d."id" = ${scope.gameId}
        AND d."entry_mode" = 'independent' AND d."status" = 'published' AND d."archived_at" IS NULL
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      ...publicGame(row),
      eventId: row.event_id,
      configVersionId: row.config_version_id,
      config: jsonRecordSchema.parse(row.config),
      archivedAt: row.archived_at,
    };
  }

  async findExistingIndependentStart(
    scope: { eventId: string; idempotencyKey: string },
    transaction: PrismTransactionContext,
  ) {
    const rows = await transaction.prisma.$queryRaw<SessionRow[]>`
      SELECT s."id", s."event_id", s."game_definition_id", s."status", d."title", d."game_kind",
        g."participant_credential_id", c."token_digest"
      FROM "event_games"."game_sessions" s
      JOIN "event_games"."game_definitions" d
        ON d."event_id" = s."event_id" AND d."id" = s."game_definition_id"
      LEFT JOIN "event_games"."session_participation_grants" g
        ON g."event_id" = s."event_id" AND g."session_id" = s."id" AND g."revoked_at" IS NULL
      LEFT JOIN "event_games"."participant_credentials" c
        ON c."event_id" = g."event_id" AND c."id" = g."participant_credential_id"
          AND c."revoked_at" IS NULL
      WHERE s."event_id" = ${scope.eventId} AND s."start_idempotency_key" = ${scope.idempotencyKey}
      FOR UPDATE OF s
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      eventId: row.event_id,
      gameId: row.game_definition_id,
      sessionId: row.id,
      title: row.title,
      kind: prismEventGameKindSchema.parse(row.game_kind),
      status: row.status,
      tokenDigest: row.token_digest,
    };
  }

  async createIndependentSessionAndGrant(
    input: CreateIndependentGameSessionRecord,
    transaction: PrismTransactionContext,
  ): Promise<IndependentGameSessionRecord> {
    const prior = await this.findExistingIndependentStart({
      eventId: input.eventId,
      idempotencyKey: input.idempotencyKey,
    }, transaction);
    if (prior) return this.replayExistingStart(prior, input);

    const credential = await this.ensureParticipantCredential(input, transaction);
    const inserted = await this.insertIndependentSession(input, transaction);
    const session = inserted ?? await this.findConcurrentStart(input, transaction);
    await this.createParticipantGrant(input, credential.id, session.id, transaction);

    const grantedSession = inserted
      ? (await this.findGrantedSession(input, credential.id, session.id, transaction)) ?? session
      : session;
    this.assertParticipantDigest(grantedSession, input.tokenDigest);
    return this.toStartedSession(grantedSession);
  }

  private replayExistingStart(
    prior: ExistingIndependentGameStartRecord,
    input: CreateIndependentGameSessionRecord,
  ): IndependentGameSessionRecord {
    if (!prior.tokenDigest) {
      throw new ForbiddenException('Participant credential is not valid for this event');
    }
    if (prior.gameId !== input.gameId || prior.tokenDigest !== input.tokenDigest) {
      throw new ConflictException('This start key was already used for a different game or participant');
    }
    return this.toStartedSession({
      id: prior.sessionId,
      event_id: prior.eventId,
      game_definition_id: prior.gameId,
      status: prior.status,
      title: prior.title,
      game_kind: prior.kind,
      participant_credential_id: null,
      token_digest: prior.tokenDigest,
    });
  }

  private async ensureParticipantCredential(
    input: CreateIndependentGameSessionRecord,
    transaction: PrismTransactionContext,
  ): Promise<{ id: string; event_id: string; revoked_at: Date | null }> {
    if (input.createCredential) {
      await transaction.prisma.$executeRaw`
        INSERT INTO "event_games"."participant_credentials" ("id", "event_id", "token_digest")
        VALUES (${input.credentialId}, ${input.eventId}, ${input.tokenDigest})
        ON CONFLICT ("token_digest") DO NOTHING
      `;
    }

    const credentials = await transaction.prisma.$queryRaw<Array<{ id: string; event_id: string; revoked_at: Date | null }>>`
      SELECT "id", "event_id", "revoked_at" FROM "event_games"."participant_credentials"
      WHERE "event_id" = ${input.eventId} AND "token_digest" = ${input.tokenDigest}
        AND "revoked_at" IS NULL FOR UPDATE
    `;
    const credential = credentials[0];
    if (!credential || credential.event_id !== input.eventId || credential.revoked_at) {
      throw new ForbiddenException('Participant credential is not valid for this event');
    }
    return credential;
  }

  private async insertIndependentSession(
    input: CreateIndependentGameSessionRecord,
    transaction: PrismTransactionContext,
  ): Promise<SessionRow | null> {
    const inserted = await transaction.prisma.$queryRaw<SessionRow[]>`
      WITH eligible AS (
        SELECT d."id", d."event_id", v."id" AS "config_version_id", v."config", d."entry_mode"
        FROM "event_games"."game_definitions" d
        JOIN LATERAL (
          SELECT cv."id", cv."config" FROM "event_games"."game_config_versions" cv
          WHERE cv."event_id" = d."event_id" AND cv."game_definition_id" = d."id"
          ORDER BY cv."version" DESC LIMIT 1
        ) v ON TRUE
        WHERE d."event_id" = ${input.eventId} AND d."id" = ${input.gameId}
          AND d."status" = 'published' AND d."archived_at" IS NULL AND d."entry_mode" = 'independent'
          AND (d."available_from" IS NULL OR d."available_from" <= NOW())
          AND (d."available_until" IS NULL OR NOW() < d."available_until")
      ), created AS (
        INSERT INTO "event_games"."game_sessions"
          ("id", "event_id", "game_definition_id", "config_version_id", "config_snapshot", "entry_mode",
           "status", "started_at", "created_by", "start_idempotency_key", "updated_at")
        SELECT ${input.sessionId}, e."event_id", e."id", e."config_version_id", e."config", 'independent',
          'live', NOW(), 'anonymous-participant', ${input.idempotencyKey}, NOW()
        FROM eligible e
        ON CONFLICT ("event_id", "start_idempotency_key") DO NOTHING
        RETURNING "id", "event_id", "game_definition_id", "status"
      )
      SELECT c."id", c."event_id", c."game_definition_id", c."status", d."title", d."game_kind",
        NULL::text AS "participant_credential_id", NULL::text AS "token_digest"
      FROM created c JOIN "event_games"."game_definitions" d
        ON d."event_id" = c."event_id" AND d."id" = c."game_definition_id"
    `;
    return inserted[0] ?? null;
  }

  private async findConcurrentStart(
    input: CreateIndependentGameSessionRecord,
    transaction: PrismTransactionContext,
  ): Promise<SessionRow> {
    const concurrent = await this.findExistingIndependentStart({
      eventId: input.eventId,
      idempotencyKey: input.idempotencyKey,
    }, transaction);
    if (!concurrent) throw new NotFoundException('Published Independent game is not currently available');
    if (concurrent.gameId !== input.gameId) {
      throw new ConflictException('This start key was already used for a different game');
    }
    if (concurrent.tokenDigest && concurrent.tokenDigest !== input.tokenDigest) {
      throw new ConflictException('This start key was already used for a different participant');
    }
    return {
      id: concurrent.sessionId,
      event_id: concurrent.eventId,
      game_definition_id: concurrent.gameId,
      status: concurrent.status,
      title: concurrent.title,
      game_kind: concurrent.kind,
      participant_credential_id: null,
      token_digest: concurrent.tokenDigest,
    };
  }

  private async createParticipantGrant(
    input: CreateIndependentGameSessionRecord,
    credentialId: string,
    sessionId: string,
    transaction: PrismTransactionContext,
  ): Promise<void> {
    await transaction.prisma.$executeRaw`
      INSERT INTO "event_games"."session_participation_grants"
        ("id", "event_id", "session_id", "participant_credential_id", "entry_mode")
      VALUES (${input.grantId}, ${input.eventId}, ${sessionId}, ${credentialId}, 'independent')
      ON CONFLICT ("event_id", "session_id", "participant_credential_id") DO NOTHING
    `;
    const grant = await transaction.prisma.$queryRaw<Array<{ token_digest: string }>>`
      SELECT c."token_digest"
      FROM "event_games"."session_participation_grants" g
      JOIN "event_games"."participant_credentials" c
        ON c."event_id" = g."event_id" AND c."id" = g."participant_credential_id"
          AND c."revoked_at" IS NULL
      WHERE g."event_id" = ${input.eventId} AND g."session_id" = ${sessionId}
        AND g."participant_credential_id" = ${credentialId} AND g."revoked_at" IS NULL
    `;
    if (grant[0]?.token_digest !== input.tokenDigest) {
      throw new ConflictException('Could not grant this participant access to the game session');
    }
  }

  private async findGrantedSession(
    input: CreateIndependentGameSessionRecord,
    credentialId: string,
    sessionId: string,
    transaction: PrismTransactionContext,
  ): Promise<SessionRow | null> {
    const created = await transaction.prisma.$queryRaw<SessionRow[]>`
      SELECT s."id", s."event_id", s."game_definition_id", s."status", d."title", d."game_kind",
        g."participant_credential_id", c."token_digest"
      FROM "event_games"."game_sessions" s
      JOIN "event_games"."game_definitions" d
        ON d."event_id" = s."event_id" AND d."id" = s."game_definition_id"
      JOIN "event_games"."session_participation_grants" g
        ON g."event_id" = s."event_id" AND g."session_id" = s."id" AND g."revoked_at" IS NULL
      JOIN "event_games"."participant_credentials" c
        ON c."event_id" = g."event_id" AND c."id" = g."participant_credential_id"
          AND c."revoked_at" IS NULL
      WHERE s."event_id" = ${input.eventId} AND s."id" = ${sessionId}
        AND g."participant_credential_id" = ${credentialId}
    `;
    return created[0] ?? null;
  }

  private assertParticipantDigest(session: SessionRow, tokenDigest: string): void {
    if (session.token_digest && session.token_digest !== tokenDigest) {
      throw new ConflictException('This start key was already used for a different participant');
    }
  }

  private toStartedSession(row: SessionRow): IndependentGameSessionRecord {
    if (row.status !== 'live') throw new ConflictException('The Independent game session is no longer available');
    return {
      sessionId: row.id,
      title: row.title,
      kind: prismEventGameKindSchema.parse(row.game_kind),
      status: 'live',
    };
  }
}
