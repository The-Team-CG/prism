import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  PrismEventGameAnalytics,
  PrismEventGameKind,
  PrismGameHostState,
  PrismGameLeaderboardEntry,
} from '@prism/types';
import { eventGameParticipantResultSchema, prismEventGameKindSchema } from '@prism/types';
import { z } from 'zod';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type {
  AppendGameDraftVersionRecord,
  CreateGameDraftRecord,
  GameDefinitionEntryMode,
  GameDefinitionRecord,
  GameDefinitionStatus,
  GameDefinitionStorePort,
  RemovedGameRecord,
} from '../contracts/game-definition-store.port';
import type {
  CreateHostGameSessionRecord,
  GameSessionRecord,
  GameSessionStorePort,
  PublishedGameDefinitionForSession,
} from '../contracts/game-session-store.port';
import { createAnonymousGameParticipantAlias } from '../domain/anonymous-game-participant-alias';

const jsonRecordSchema = z.record(z.string(), z.unknown());

interface DefinitionRow {
  id: string;
  event_id: string;
  slug: string;
  title: string;
  game_kind: string;
  entry_mode: string;
  status: string;
  version: number;
  config_version_id: string;
  config: unknown;
  available_from?: Date | null;
  available_until?: Date | null;
  has_started_session?: boolean;
}

interface SessionDefinitionRow extends DefinitionRow {
  available_from: Date | null;
  available_until: Date | null;
}

interface SessionRow {
  id: string;
  event_id: string;
  game_definition_id: string;
  config_version_id: string;
  config_snapshot: unknown;
  entry_mode: string;
  status: string;
  scheduled_start_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  title: string;
  game_kind: string;
}

interface HostStateRow {
  event_id: string;
  session_id: string;
  game_id: string;
  title: string;
  game_kind: string;
  status: string;
  scheduled_start_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  participant_count: number;
  wheel_result: unknown;
}

interface ScoreRow {
  group_key: string;
  team_id: string | null;
  team_label: string | null;
  score: number;
  rank: number;
}

function leaderboardAwardRecipient(score: ScoreRow): NonNullable<PrismGameLeaderboardEntry["awardRecipient"]> {
  if (score.team_id) return { type: "team", teamId: score.team_id };
  const prefix = "participant:";
  if (!score.group_key.startsWith(prefix)) {
    throw new Error("Invalid event-game leaderboard group key");
  }
  return { type: "participant", participationGrantId: score.group_key.slice(prefix.length) };
}

function persistedWheelResult(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = eventGameParticipantResultSchema.safeParse(value);
  if (!parsed.success || parsed.data.kind !== 'spin-wheel') {
    throw new Error('Persisted Spin the Wheel session result is invalid');
  }
  return parsed.data;
}

interface HostReadContextRow {
  game_kind: string;
  status: string;
  config_snapshot: unknown;
  started_at: Date | null;
  ended_at: Date | null;
  paused_at: Date | null;
  total_paused_ms: bigint | number | string;
  round_offset_ms: number;
  wheel_result: unknown;
}

interface EventAnalyticsTotalsRow {
  games_created: bigint | number | string;
  sessions_started: bigint | number | string;
  sessions_completed: bigint | number | string;
  distinct_event_participants: bigint | number | string;
  participant_joins: bigint | number | string;
  rounds_answered: bigint | number | string;
}

interface EventAnalyticsSessionRow {
  session_id: string;
  game_title: string;
  game_kind: string;
  status: string;
  participant_joins: bigint | number | string;
  rounds_answered: bigint | number | string;
}

interface EventAnalyticsByDayRow {
  date: string;
  participant_joins: bigint | number | string;
}

function entryMode(value: string): GameDefinitionEntryMode {
  if (value === 'active' || value === 'independent') return value;
  throw new Error(`Invalid persisted game entry mode: ${value}`);
}

function definitionStatus(value: string): GameDefinitionStatus {
  if (value === 'draft' || value === 'published' || value === 'removed') return value;
  throw new Error(`Invalid persisted game definition status: ${value}`);
}

function gameKind(value: string): PrismEventGameKind {
  return prismEventGameKindSchema.parse(value);
}

function jsonRecord(value: unknown): Readonly<Record<string, unknown>> {
  return jsonRecordSchema.parse(value);
}

function sessionStatus(value: string): GameSessionRecord['status'] {
  if (['scheduled', 'lobby', 'live', 'paused', 'completed', 'cancelled'].includes(value)) {
    return value as GameSessionRecord['status'];
  }
  throw new Error(`Invalid persisted game session status: ${value}`);
}

function pausedDurationMs(value: bigint | number | string): number {
  const duration = Number(value);
  if (!Number.isSafeInteger(duration) || duration < 0) throw new Error('Persisted game pause duration is invalid');
  return duration;
}

function analyticsCount(value: bigint | number | string): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Persisted event game analytics count is invalid');
  }
  return count;
}

function definitionRecord(row: DefinitionRow): GameDefinitionRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    slug: row.slug,
    title: row.title,
    kind: gameKind(row.game_kind),
    entryMode: entryMode(row.entry_mode),
    status: definitionStatus(row.status),
    version: row.version,
    configVersionId: row.config_version_id,
    config: jsonRecord(row.config),
    availableFrom: row.available_from ?? null,
    availableUntil: row.available_until ?? null,
    hasStartedSession: row.has_started_session ?? false,
  };
}

function sessionRecord(row: SessionRow): GameSessionRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    gameId: row.game_definition_id,
    configVersionId: row.config_version_id,
    configSnapshot: jsonRecord(row.config_snapshot),
    title: row.title,
    kind: gameKind(row.game_kind),
    entryMode: entryMode(row.entry_mode),
    status: sessionStatus(row.status),
    scheduledStartAt: row.scheduled_start_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

@Injectable()
export class EventGamesPrismaStoreAdapter implements GameDefinitionStorePort, GameSessionStorePort {
  async listForEvent(eventId: string, transaction: PrismTransactionContext): Promise<GameDefinitionRecord[]> {
    const rows = await transaction.prisma.$queryRaw<DefinitionRow[]>`
      SELECT d."id", d."event_id", d."slug", d."title", d."game_kind", d."entry_mode", d."status",
        v."version", v."id" AS "config_version_id", v."config", d."available_from", d."available_until",
        EXISTS (SELECT 1 FROM "event_games"."game_sessions" s WHERE s."event_id" = d."event_id"
          AND s."game_definition_id" = d."id" AND s."started_at" IS NOT NULL) AS "has_started_session"
      FROM "event_games"."game_definitions" d
      JOIN LATERAL (
        SELECT cv."id", cv."version", cv."config"
        FROM "event_games"."game_config_versions" cv
        WHERE cv."event_id" = d."event_id" AND cv."game_definition_id" = d."id"
        ORDER BY cv."version" DESC LIMIT 1
      ) v ON TRUE
      WHERE d."event_id" = ${eventId} AND d."status" <> 'removed'
      ORDER BY d."created_at" DESC, d."id"
    `;
    return rows.map(definitionRecord);
  }

  async findForEvent(
    scope: { eventId: string; gameId: string },
    transaction: PrismTransactionContext,
  ): Promise<GameDefinitionRecord | null> {
    const rows = await transaction.prisma.$queryRaw<DefinitionRow[]>`
      SELECT d."id", d."event_id", d."slug", d."title", d."game_kind", d."entry_mode", d."status",
        v."version", v."id" AS "config_version_id", v."config", d."available_from", d."available_until",
        EXISTS (SELECT 1 FROM "event_games"."game_sessions" s WHERE s."event_id" = d."event_id"
          AND s."game_definition_id" = d."id" AND s."started_at" IS NOT NULL) AS "has_started_session"
      FROM "event_games"."game_definitions" d
      JOIN LATERAL (
        SELECT cv."id", cv."version", cv."config"
        FROM "event_games"."game_config_versions" cv
        WHERE cv."event_id" = d."event_id" AND cv."game_definition_id" = d."id"
        ORDER BY cv."version" DESC LIMIT 1
      ) v ON TRUE
      WHERE d."event_id" = ${scope.eventId} AND d."id" = ${scope.gameId}
      LIMIT 1
    `;
    return rows[0] ? definitionRecord(rows[0]) : null;
  }

  async createDraft(input: CreateGameDraftRecord, transaction: PrismTransactionContext): Promise<GameDefinitionRecord> {
    await transaction.prisma.$executeRaw`
      INSERT INTO "event_games"."game_definitions"
        ("id", "event_id", "slug", "title", "game_kind", "entry_mode", "status", "created_by",
         "available_from", "available_until", "updated_at")
      VALUES (${input.id}, ${input.eventId}, ${input.slug}, ${input.title}, ${input.kind}, ${input.entryMode}, 'draft',
        ${input.createdBy}, ${input.availableFrom}, ${input.availableUntil}, NOW())
    `;
    await transaction.prisma.$executeRaw`
      INSERT INTO "event_games"."game_config_versions"
        ("id", "game_definition_id", "event_id", "version", "config", "created_by")
      VALUES (${randomUUID()}, ${input.id}, ${input.eventId}, 1, ${JSON.stringify(input.config)}::jsonb, ${input.createdBy})
    `;
    return {
      id: input.id,
      eventId: input.eventId,
      slug: input.slug,
      title: input.title,
      kind: input.kind,
      entryMode: input.entryMode,
      status: 'draft',
      version: 1,
      configVersionId: undefined,
      config: input.config,
      availableFrom: input.availableFrom,
      availableUntil: input.availableUntil,
    };
  }

  async findDraftForUpdate(
    scope: { eventId: string; gameId: string },
    transaction: PrismTransactionContext,
  ): Promise<GameDefinitionRecord | null> {
    const rows = await transaction.prisma.$queryRaw<DefinitionRow[]>`
      SELECT d."id", d."event_id", d."slug", d."title", d."game_kind", d."entry_mode", d."status",
        v."version", v."id" AS "config_version_id", v."config", d."available_from", d."available_until",
        EXISTS (SELECT 1 FROM "event_games"."game_sessions" s WHERE s."event_id" = d."event_id"
          AND s."game_definition_id" = d."id" AND s."started_at" IS NOT NULL) AS "has_started_session"
      FROM "event_games"."game_definitions" d
      JOIN LATERAL (
        SELECT cv."id", cv."version", cv."config"
        FROM "event_games"."game_config_versions" cv
        WHERE cv."event_id" = d."event_id" AND cv."game_definition_id" = d."id"
        ORDER BY cv."version" DESC LIMIT 1
      ) v ON TRUE
      WHERE d."event_id" = ${scope.eventId} AND d."id" = ${scope.gameId}
        AND d."status" IN ('draft', 'published') AND d."archived_at" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "event_games"."game_sessions" s WHERE s."event_id" = d."event_id"
          AND s."game_definition_id" = d."id" AND s."started_at" IS NOT NULL)
      FOR UPDATE OF d
    `;
    return rows[0] ? definitionRecord(rows[0]) : null;
  }

  async appendDraftVersion(input: AppendGameDraftVersionRecord, transaction: PrismTransactionContext): Promise<GameDefinitionRecord> {
    const rows = await transaction.prisma.$queryRaw<DefinitionRow[]>`
      UPDATE "event_games"."game_definitions" d
      SET "title" = ${input.title}, "available_from" = ${input.availableFrom},
        "available_until" = ${input.availableUntil}, "updated_by" = ${input.actorId}, "updated_at" = NOW()
      WHERE d."event_id" = ${input.eventId} AND d."id" = ${input.gameId}
        AND d."status" IN ('draft', 'published') AND d."archived_at" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "event_games"."game_sessions" s WHERE s."event_id" = d."event_id"
          AND s."game_definition_id" = d."id" AND s."started_at" IS NOT NULL)
      RETURNING d."id", d."event_id", d."slug", d."title", d."game_kind", d."entry_mode", d."status",
        ${input.version}::integer AS "version", ''::text AS "config_version_id", ${JSON.stringify(input.config)}::jsonb AS "config",
        d."available_from", d."available_until"
    `;
    if (!rows[0]) throw new ConflictException('Game draft changed before its new version could be saved');

    const configVersionId = randomUUID();
    await transaction.prisma.$executeRaw`
      INSERT INTO "event_games"."game_config_versions"
        ("id", "game_definition_id", "event_id", "version", "config", "created_by")
      VALUES (${configVersionId}, ${input.gameId}, ${input.eventId}, ${input.version}, ${JSON.stringify(input.config)}::jsonb, ${input.actorId})
    `;
    await transaction.prisma.$executeRaw`
      UPDATE "event_games"."game_sessions"
      SET "config_version_id" = ${configVersionId}, "config_snapshot" = ${JSON.stringify(input.config)}::jsonb,
        "updated_at" = NOW()
      WHERE "event_id" = ${input.eventId} AND "game_definition_id" = ${input.gameId}
        AND "started_at" IS NULL AND "status" IN ('scheduled', 'lobby')
    `;
    return { ...definitionRecord(rows[0]), configVersionId, availableFrom: input.availableFrom, availableUntil: input.availableUntil };
  }

  async removeUnstartedGame(
    scope: { eventId: string; gameId: string; actorId: string },
    transaction: PrismTransactionContext,
  ): Promise<RemovedGameRecord | null> {
    const before = await transaction.prisma.$queryRaw<DefinitionRow[]>`
      SELECT d."id", d."event_id", d."slug", d."title", d."game_kind", d."entry_mode", d."status",
        v."version", v."id" AS "config_version_id", v."config", d."available_from", d."available_until"
      FROM "event_games"."game_definitions" d
      JOIN LATERAL (
        SELECT cv."id", cv."version", cv."config"
        FROM "event_games"."game_config_versions" cv
        WHERE cv."event_id" = d."event_id" AND cv."game_definition_id" = d."id"
        ORDER BY cv."version" DESC LIMIT 1
      ) v ON TRUE
      WHERE d."event_id" = ${scope.eventId} AND d."id" = ${scope.gameId}
        AND d."status" IN ('draft', 'published') AND d."archived_at" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "event_games"."game_sessions" s WHERE s."event_id" = d."event_id"
          AND s."game_definition_id" = d."id" AND s."started_at" IS NOT NULL)
      FOR UPDATE OF d
    `;
    if (!before[0]) return null;
    const changed = await transaction.prisma.$queryRaw<DefinitionRow[]>`
      UPDATE "event_games"."game_definitions" d
      SET "status" = 'removed', "archived_at" = NOW(), "updated_by" = ${scope.actorId}, "updated_at" = NOW()
      WHERE d."event_id" = ${scope.eventId} AND d."id" = ${scope.gameId}
        AND d."status" IN ('draft', 'published') AND d."archived_at" IS NULL
      RETURNING d."id", d."event_id", d."slug", d."title", d."game_kind", d."entry_mode", d."status",
        ${before[0].version}::integer AS "version", ${before[0].config_version_id}::text AS "config_version_id",
        ${JSON.stringify(jsonRecord(before[0].config))}::jsonb AS "config", d."available_from", d."available_until"
    `;
    if (!changed[0]) return null;
    const cancellable = await transaction.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "event_games"."game_sessions"
      SET "status" = 'cancelled', "ended_at" = NOW(), "scheduled_start_at" = NULL, "updated_at" = NOW()
      WHERE "event_id" = ${scope.eventId} AND "game_definition_id" = ${scope.gameId}
        AND "started_at" IS NULL AND "status" IN ('scheduled', 'lobby')
      RETURNING "id"
    `;
    return {
      game: definitionRecord(changed[0]),
      beforeStatus: definitionStatus(before[0].status),
      beforeVersion: before[0].version,
      cancelledSessionIds: cancellable.map(({ id }) => id),
    };
  }

  async publishDraft(
    scope: { eventId: string; gameId: string; actorId: string; expectedVersion: number },
    transaction: PrismTransactionContext,
  ): Promise<RemovedGameRecord | null> {
    const before = await this.findDraftForUpdate({ eventId: scope.eventId, gameId: scope.gameId }, transaction);
    if (!before || before.version !== scope.expectedVersion) return null;
    const rows = await transaction.prisma.$queryRaw<DefinitionRow[]>`
      UPDATE "event_games"."game_definitions" d
      SET "status" = 'published', "published_at" = NOW(), "updated_by" = ${scope.actorId}, "updated_at" = NOW()
      WHERE d."event_id" = ${scope.eventId} AND d."id" = ${scope.gameId} AND d."status" = 'draft'
      RETURNING d."id", d."event_id", d."slug", d."title", d."game_kind", d."entry_mode", d."status",
        ${before.version}::integer AS "version", ${before.configVersionId ?? ''}::text AS "config_version_id",
        ${JSON.stringify(before.config)}::jsonb AS "config", d."available_from", d."available_until"
    `;
    if (!rows[0]) return null;
    return { game: definitionRecord(rows[0]), beforeStatus: before.status, beforeVersion: before.version };
  }

  async findPublishedDefinitionForSession(
    scope: { eventId: string; gameId: string },
    transaction: PrismTransactionContext,
  ): Promise<PublishedGameDefinitionForSession | null> {
    const rows = await transaction.prisma.$queryRaw<SessionDefinitionRow[]>`
      SELECT d."id", d."event_id", d."slug", d."title", d."game_kind", d."entry_mode", d."status",
        v."version", v."id" AS "config_version_id", v."config",
        d."available_from", d."available_until"
      FROM "event_games"."game_definitions" d
      JOIN LATERAL (
        SELECT cv."id", cv."version", cv."config"
        FROM "event_games"."game_config_versions" cv
        WHERE cv."event_id" = d."event_id" AND cv."game_definition_id" = d."id"
        ORDER BY cv."version" DESC LIMIT 1
      ) v ON TRUE
      WHERE d."event_id" = ${scope.eventId} AND d."id" = ${scope.gameId} AND d."status" = 'published'
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      eventId: row.event_id,
      title: row.title,
      kind: gameKind(row.game_kind),
      entryMode: entryMode(row.entry_mode),
      status: 'published',
      version: row.version,
      configVersionId: row.config_version_id,
      config: jsonRecord(row.config),
      availableFrom: row.available_from,
      availableUntil: row.available_until,
    };
  }

  async createHostSession(input: CreateHostGameSessionRecord, transaction: PrismTransactionContext): Promise<GameSessionRecord> {
    const rows = await transaction.prisma.$queryRaw<SessionRow[]>`
      WITH created AS (
        INSERT INTO "event_games"."game_sessions"
          ("id", "event_id", "game_definition_id", "config_version_id", "config_snapshot", "entry_mode", "status",
           "scheduled_start_at", "created_by", "start_idempotency_key", "updated_at")
        SELECT ${input.id}, d."event_id", d."id", v."id", ${JSON.stringify(input.configSnapshot)}::jsonb,
          ${input.entryMode}, ${input.status}, ${input.scheduledStartAt}, ${input.createdBy}, ${input.startIdempotencyKey}, NOW()
        FROM "event_games"."game_definitions" d
        JOIN "event_games"."game_config_versions" v
          ON v."event_id" = d."event_id" AND v."game_definition_id" = d."id" AND v."id" = ${input.configVersionId}
        WHERE d."event_id" = ${input.eventId} AND d."id" = ${input.gameId} AND d."status" = 'published'
        RETURNING *
      )
      SELECT created."id", created."event_id", created."game_definition_id", created."config_version_id",
        created."config_snapshot", created."entry_mode", created."status", created."scheduled_start_at",
        created."started_at", created."ended_at", d."title", d."game_kind"
      FROM created JOIN "event_games"."game_definitions" d
        ON d."event_id" = created."event_id" AND d."id" = created."game_definition_id"
    `;
    if (!rows[0]) throw new ConflictException('Published game changed before its session could be created');
    return sessionRecord(rows[0]);
  }

  async getHostState(
    scope: { eventId: string; sessionId: string },
    transaction: PrismTransactionContext,
  ): Promise<PrismGameHostState | null> {
    const sessions = await transaction.prisma.$queryRaw<HostStateRow[]>`
      SELECT s."event_id", s."id" AS "session_id", d."id" AS "game_id", d."title", d."game_kind",
        s."status", s."scheduled_start_at", s."started_at", s."ended_at", s."wheel_result",
        (SELECT COUNT(*)::integer FROM "event_games"."session_participation_grants" g
          WHERE g."event_id" = s."event_id" AND g."session_id" = s."id" AND g."revoked_at" IS NULL) AS "participant_count"
      FROM "event_games"."game_sessions" s
      JOIN "event_games"."game_definitions" d
        ON d."event_id" = s."event_id" AND d."id" = s."game_definition_id"
      WHERE s."event_id" = ${scope.eventId} AND s."id" = ${scope.sessionId}
    `;
    const row = sessions[0];
    if (!row) return null;

    const scores = await transaction.prisma.$queryRaw<ScoreRow[]>`
      WITH grant_scores AS (
        SELECT g."id", g."team_id", MIN(g."team_label") AS "team_label", COALESCE(SUM(l."points"), 0)::integer AS "score"
        FROM "event_games"."session_participation_grants" g
        JOIN "event_games"."score_ledger" l
          ON l."event_id" = g."event_id" AND l."session_id" = g."session_id"
            AND l."participation_grant_id" = g."id"
        LEFT JOIN LATERAL (
          SELECT m."action" FROM "event_games"."moderation_actions" m
          WHERE m."event_id" = l."event_id" AND m."session_id" = l."session_id"
            AND m."submission_id" = l."source_event_id"
          ORDER BY m."created_at" DESC, m."id" DESC LIMIT 1
        ) moderation ON TRUE
        WHERE g."event_id" = ${scope.eventId} AND g."session_id" = ${scope.sessionId}
          AND g."revoked_at" IS NULL AND moderation."action" IS DISTINCT FROM 'hide_submission'
        GROUP BY g."id", g."team_id"
      ), score_groups AS (
        SELECT CASE WHEN "team_id" IS NULL THEN 'participant:' || "id" ELSE 'team:' || "team_id" END AS "group_key",
          "team_id", MIN("team_label") AS "team_label", SUM("score")::integer AS "score"
        FROM grant_scores
        GROUP BY CASE WHEN "team_id" IS NULL THEN 'participant:' || "id" ELSE 'team:' || "team_id" END, "team_id"
      ), team_awards AS (
        SELECT 'team:' || a."team_id" AS "group_key", a."team_id", labels."team_label",
          SUM(a."points")::integer AS "score"
        FROM "event_games"."awards" a
        JOIN (
          SELECT g."event_id", g."session_id", g."team_id", MIN(g."team_label") AS "team_label"
          FROM "event_games"."session_participation_grants" g
          WHERE g."event_id" = ${scope.eventId} AND g."session_id" = ${scope.sessionId}
            AND g."revoked_at" IS NULL
          GROUP BY g."event_id", g."session_id", g."team_id"
        ) labels ON labels."event_id" = a."event_id" AND labels."session_id" = a."session_id"
          AND labels."team_id" = a."team_id"
        WHERE a."event_id" = ${scope.eventId} AND a."session_id" = ${scope.sessionId}
          AND a."recipient_type" = 'team' AND a."award_kind" = 'points' AND a."points" IS NOT NULL
        GROUP BY a."team_id", labels."team_label"
      ), all_scores AS (
        SELECT * FROM score_groups UNION ALL SELECT * FROM team_awards
      ), combined AS (
        SELECT "group_key", "team_id", MIN("team_label") AS "team_label", SUM("score")::integer AS "score"
        FROM all_scores GROUP BY "group_key", "team_id"
      ), ranked AS (
        SELECT *, ROW_NUMBER() OVER (ORDER BY "score" DESC, "group_key")::integer AS "rank"
        FROM combined
      )
      SELECT "group_key", "team_id", "team_label", "score", "rank"
      FROM ranked ORDER BY "rank" LIMIT 10
    `;
    const status = row.status === 'live' || row.status === 'scheduled' || row.status === 'lobby' ||
      row.status === 'paused' || row.status === 'completed' || row.status === 'cancelled'
      ? row.status
      : (() => { throw new Error(`Invalid persisted game session status: ${row.status}`); })();

    return {
      eventId: row.event_id,
      sessionId: row.session_id,
      game: { id: row.game_id, title: row.title, kind: gameKind(row.game_kind) },
      status,
      scheduledStartAt: row.scheduled_start_at?.toISOString() ?? null,
      startedAt: row.started_at?.toISOString() ?? null,
      endedAt: row.ended_at?.toISOString() ?? null,
      sessionResult: persistedWheelResult(row.wheel_result),
      participantCount: row.participant_count,
      currentRound: null,
      leaderboard: scores.map((score) => {
        const awardRecipient = leaderboardAwardRecipient(score);
        const label = awardRecipient.type === 'team'
          ? (score.team_label ?? 'Team')
          : createAnonymousGameParticipantAlias(awardRecipient.participationGrantId);
        return {
          rank: score.rank,
          label,
          score: score.score,
          ...(score.team_id && score.team_label ? { teamLabel: score.team_label } : {}),
          awardRecipient,
        };
      }),
    };
  }

  async getPublicLeaderboard(
    scope: { eventId: string; sessionId: string },
    transaction: PrismTransactionContext,
  ) {
    const state = await this.getHostState(scope, transaction);
    return (state?.leaderboard ?? []).map(({ rank, label, score, teamLabel }) => ({
      rank,
      label,
      score,
      ...(teamLabel ? { teamLabel } : {}),
    }));
  }

  async getHostReadContext(
    scope: { eventId: string; sessionId: string },
    transaction: PrismTransactionContext,
  ) {
    const rows = await transaction.prisma.$queryRaw<HostReadContextRow[]>`
      SELECT d."game_kind", s."status", s."config_snapshot", s."started_at", s."ended_at",
        s."paused_at", s."total_paused_ms", s."round_offset_ms", s."wheel_result"
      FROM "event_games"."game_sessions" s
      JOIN "event_games"."game_definitions" d
        ON d."event_id" = s."event_id" AND d."id" = s."game_definition_id"
      WHERE s."event_id" = ${scope.eventId} AND s."id" = ${scope.sessionId}
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      kind: gameKind(row.game_kind),
      status: sessionStatus(row.status),
      configSnapshot: jsonRecord(row.config_snapshot),
      startedAt: row.started_at,
      endedAt: row.ended_at,
      pausedAt: row.paused_at,
      totalPausedMs: pausedDurationMs(row.total_paused_ms),
      roundOffsetMs: row.round_offset_ms,
      wheelResult: persistedWheelResult(row.wheel_result),
    };
  }

  async getEventAnalytics(
    eventId: string,
    transaction: PrismTransactionContext,
  ): Promise<PrismEventGameAnalytics> {
    const totalsRows = await transaction.prisma.$queryRaw<EventAnalyticsTotalsRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "event_games"."game_definitions" d
          WHERE d."event_id" = ${eventId}) AS "games_created",
        (SELECT COUNT(*) FROM "event_games"."game_sessions" s
          WHERE s."event_id" = ${eventId} AND s."started_at" IS NOT NULL) AS "sessions_started",
        (SELECT COUNT(*) FROM "event_games"."game_sessions" s
          WHERE s."event_id" = ${eventId} AND s."status" = 'completed') AS "sessions_completed",
        (SELECT COUNT(*) FROM "event_games"."participant_credentials" c
          WHERE c."event_id" = ${eventId}) AS "distinct_event_participants",
        (SELECT COUNT(*) FROM "event_games"."session_participation_grants" g
          WHERE g."event_id" = ${eventId}) AS "participant_joins",
        (SELECT COUNT(DISTINCT (a."participation_grant_id", a."round_key")) FROM "event_games"."submissions" a
          WHERE a."event_id" = ${eventId}) AS "rounds_answered"
    `;
    const totals = totalsRows[0];
    if (!totals) throw new Error('Event game analytics totals are unavailable');
    const gamesCreated = analyticsCount(totals.games_created);
    const sessionsStarted = analyticsCount(totals.sessions_started);
    const sessionsCompleted = analyticsCount(totals.sessions_completed);
    const distinctEventParticipants = analyticsCount(totals.distinct_event_participants);
    const participantJoins = analyticsCount(totals.participant_joins);
    const roundsAnswered = analyticsCount(totals.rounds_answered);

    const sessionRows = await transaction.prisma.$queryRaw<EventAnalyticsSessionRow[]>`
      SELECT s."id" AS "session_id", d."title" AS "game_title", d."game_kind",
        s."status",
        (SELECT COUNT(*) FROM "event_games"."session_participation_grants" g
          WHERE g."event_id" = s."event_id" AND g."session_id" = s."id") AS "participant_joins",
        (SELECT COUNT(DISTINCT (a."participation_grant_id", a."round_key")) FROM "event_games"."submissions" a
          WHERE a."event_id" = s."event_id" AND a."session_id" = s."id") AS "rounds_answered"
      FROM "event_games"."game_sessions" s
      JOIN "event_games"."game_definitions" d
        ON d."event_id" = s."event_id" AND d."id" = s."game_definition_id"
      WHERE s."event_id" = ${eventId}
      ORDER BY s."created_at", s."id"
    `;
    const participationRows = await transaction.prisma.$queryRaw<EventAnalyticsByDayRow[]>`
      SELECT to_char(date_trunc('day', g."granted_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS "date",
        COUNT(*) AS "participant_joins"
      FROM "event_games"."session_participation_grants" g
      WHERE g."event_id" = ${eventId}
      GROUP BY 1
      ORDER BY 1
    `;

    return {
      eventId,
      totals: {
        gamesCreated,
        sessionsStarted,
        sessionsCompleted,
        distinctEventParticipants,
        participantJoins,
        roundsAnswered,
        completionRate: sessionsStarted === 0 ? 0 : sessionsCompleted / sessionsStarted,
      },
      sessions: sessionRows.map((row) => ({
        sessionId: row.session_id,
        gameTitle: row.game_title,
        kind: gameKind(row.game_kind),
        status: sessionStatus(row.status),
        participantJoins: analyticsCount(row.participant_joins),
        roundsAnswered: analyticsCount(row.rounds_answered),
      })),
      participationOverTime: participationRows.map((row) => ({
        date: row.date,
        participantJoins: analyticsCount(row.participant_joins),
      })),
    };
  }
}
