import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { eventGameParticipantResultSchema, prismEventGameKindSchema } from '@prism/types';
import { z } from 'zod';
import type { PrismEventGameKind } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type {
  GameActionStorePort,
  GameParticipantStateSummary,
  GameParticipantActionContext,
  GameResponseHistoryPage,
  StoredGameResponse,
} from '../contracts/game-action-store.port';
import { createAnonymousGameParticipantAlias } from '../domain/anonymous-game-participant-alias';

interface ParticipantActionContextRow {
  event_id: string;
  session_id: string;
  game_id: string;
  title: string;
  game_kind: string;
  entry_mode: string;
  available_from: Date | null;
  available_until: Date | null;
  status: string;
  config_snapshot: unknown;
  started_at: Date | null;
  ended_at: Date | null;
  paused_at: Date | null;
  total_paused_ms: bigint | number | string;
  round_offset_ms: number;
  team_id: string | null;
  team_label: string | null;
  participation_grant_id: string;
  wheel_result: unknown;
}

interface InsertedSubmissionRow {
  submission_id: string;
}

interface ParticipantScoreRow {
  score: number | null;
  has_submitted: boolean;
  has_voted: boolean;
  result: unknown;
}
interface ParticipantTotalRow { score: number | null }
interface VoteCountRow { label: string; count: number }
interface RoundModerationQueueRow { id: string; round_number: number; response: string | null }
interface FamilyFeudModerationQueueRow { id: string; round_number: number; answer: string | null }
interface ApprovedRoundResponseRow { response: string | null }

interface GameResponseRow {
  id: string;
  round_number: number;
  participation_grant_id: string;
  payload: unknown;
  moderation_action: string | null;
  score_result: unknown;
  created_at: Date;
}

interface SessionExistsRow { exists: boolean }
interface RedactedCountRow { redacted_count: number }

const responsePayloadSchema = z.record(
  z.string().trim().min(1).max(64),
  z.union([
    z.string().trim().min(1).max(500),
    z.number().finite(),
    z.boolean(),
    z.array(z.string().trim().min(1).max(120)).min(1).max(50),
  ]),
);

const responseScoreSchema = z.object({
  points: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  isCorrect: z.boolean(),
  result: eventGameParticipantResultSchema.optional(),
}).strict();

const PROFILE_RESPONSE_KEYS = new Set([
  "avatar", "avatarurl", "bio", "displayname", "email", "firstname", "fullname",
  "handle", "image", "imageurl", "lastname", "name", "participantname", "photo",
  "photourl", "phone", "phonenumber", "picture", "profile", "profileurl", "username",
]);

function responsePayload(value: unknown): Readonly<Record<string, string | number | boolean | readonly string[]>> {
  const parsed = responsePayloadSchema.parse(value);
  return Object.fromEntries(Object.entries(parsed).filter(([key]) =>
    !PROFILE_RESPONSE_KEYS.has(key.toLowerCase().replace(/[^a-z0-9]/g, "")),
  ));
}

function gameKind(value: string): PrismEventGameKind {
  return prismEventGameKindSchema.parse(value);
}

function configSnapshot(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Persisted game session configuration is invalid');
  }
  return value as Readonly<Record<string, unknown>>;
}

function pausedDurationMs(value: bigint | number | string): number {
  const duration = Number(value);
  if (!Number.isSafeInteger(duration) || duration < 0) {
    throw new Error('Persisted game pause duration is invalid');
  }
  return duration;
}

function sessionStatus(value: string): GameParticipantActionContext['status'] {
  if (!['scheduled', 'lobby', 'live', 'paused', 'completed', 'cancelled'].includes(value)) {
    throw new Error(`Invalid persisted game session status: ${value}`);
  }
  return value;
}

function participantChoiceResult(value: unknown): GameParticipantStateSummary['result'] {
  const parsed = eventGameParticipantResultSchema.safeParse(value);
  return parsed.success && parsed.data.kind === 'singleplayer-choice' ? parsed.data : undefined;
}

@Injectable()
export class EventGamesActionPrismaStoreAdapter implements GameActionStorePort {
  async findParticipantActionContext(
    input: { sessionId: string; tokenDigest: string },
    transaction: PrismTransactionContext,
  ): Promise<GameParticipantActionContext | null> {
    const rows = await transaction.prisma.$queryRaw<ParticipantActionContextRow[]>`
      SELECT s."event_id", s."id" AS "session_id", d."id" AS "game_id",
        d."title", d."game_kind", d."entry_mode", d."available_from", d."available_until", s."status",
        s."config_snapshot", s."started_at", s."ended_at", s."paused_at", s."total_paused_ms", s."round_offset_ms",
        s."wheel_result",
        g."team_id", g."team_label", g."id" AS "participation_grant_id"
      FROM "event_games"."game_sessions" s
      JOIN "event_games"."game_definitions" d
        ON d."event_id" = s."event_id" AND d."id" = s."game_definition_id"
      JOIN "event_games"."session_participation_grants" g
        ON g."event_id" = s."event_id" AND g."session_id" = s."id"
      JOIN "event_games"."participant_credentials" c
        ON c."event_id" = g."event_id" AND c."id" = g."participant_credential_id"
      WHERE s."id" = ${input.sessionId}
        AND c."token_digest" = ${input.tokenDigest}
        AND c."revoked_at" IS NULL
        AND g."revoked_at" IS NULL
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      eventId: row.event_id,
      sessionId: row.session_id,
      gameId: row.game_id,
      title: row.title,
      kind: gameKind(row.game_kind),
      entryMode: row.entry_mode === 'independent' ? 'independent' : 'active',
      availableFrom: row.available_from,
      availableUntil: row.available_until,
      status: sessionStatus(row.status),
      configSnapshot: configSnapshot(row.config_snapshot),
      startedAt: row.started_at,
      endedAt: row.ended_at,
      pausedAt: row.paused_at,
      totalPausedMs: pausedDurationMs(row.total_paused_ms),
      roundOffsetMs: row.round_offset_ms,
      teamId: row.team_id,
      teamLabel: row.team_label,
      participationGrantId: row.participation_grant_id,
      wheelResult: row.wheel_result === null || row.wheel_result === undefined
        ? null
        : (() => {
          const parsed = eventGameParticipantResultSchema.safeParse(row.wheel_result);
          if (!parsed.success || parsed.data.kind !== 'spin-wheel') {
            throw new Error('Persisted Spin the Wheel session result is invalid');
          }
          return parsed.data;
        })(),
    };
  }

  async recordParticipantAction(
    input: Parameters<GameActionStorePort['recordParticipantAction']>[0],
    transaction: PrismTransactionContext,
  ): Promise<{ points: number; result?: Parameters<GameActionStorePort['recordParticipantAction']>[0]['result'] } | null> {
    const teamId = input.teamAssignment?.teamId ?? null;
    const teamLabel = input.teamAssignment?.teamLabel ?? null;
    const inserted = await transaction.prisma.$queryRaw<InsertedSubmissionRow[]>`
      WITH eligible AS MATERIALIZED (
        SELECT s."event_id", s."id" AS "session_id", g."id" AS "participation_grant_id"
        FROM "event_games"."game_sessions" s
        JOIN "event_games"."session_participation_grants" g
          ON g."event_id" = s."event_id" AND g."session_id" = s."id"
        JOIN "event_games"."participant_credentials" c
          ON c."event_id" = g."event_id" AND c."id" = g."participant_credential_id"
        JOIN "event_games"."game_definitions" d
          ON d."event_id" = s."event_id" AND d."id" = s."game_definition_id"
        WHERE s."event_id" = ${input.eventId}
          AND s."id" = ${input.sessionId}
          AND s."status" = 'live'
          AND s."started_at" IS NOT NULL
          AND g."id" = ${input.participationGrantId}
          AND g."revoked_at" IS NULL
          AND c."token_digest" = ${input.tokenDigest}
          AND c."revoked_at" IS NULL
          AND (s."entry_mode" <> 'independent' OR (
            (d."available_from" IS NULL OR ${input.createdAt} >= d."available_from")
            AND (d."available_until" IS NULL OR ${input.createdAt} < d."available_until")
          ))
          AND (${input.deadlineAt}::timestamptz IS NULL OR ${input.createdAt} <= ${input.deadlineAt})
        FOR UPDATE OF s, g, c
      ), assigned AS (
        UPDATE "event_games"."session_participation_grants" g
        SET "team_id" = CASE WHEN ${teamId}::text IS NULL THEN g."team_id" ELSE COALESCE(g."team_id", ${teamId}) END,
            "team_label" = CASE WHEN ${teamLabel}::text IS NULL THEN g."team_label" ELSE COALESCE(g."team_label", ${teamLabel}) END
        FROM eligible e
        WHERE g."event_id" = e."event_id" AND g."session_id" = e."session_id"
          AND g."id" = e."participation_grant_id"
          AND ${teamId}::text IS NOT NULL
          AND (${teamId}::text IS NULL OR g."team_id" IS NULL OR
            (g."team_id" = ${teamId} AND g."team_label" = ${teamLabel}))
        RETURNING g."event_id", g."session_id", g."id" AS "participation_grant_id"
      ), actionable AS (
        SELECT e."event_id", e."session_id", e."participation_grant_id"
        FROM eligible e WHERE ${teamId}::text IS NULL
        UNION ALL
        SELECT a."event_id", a."session_id", a."participation_grant_id" FROM assigned a
      ), inserted AS (
        INSERT INTO "event_games"."submissions"
          ("id", "event_id", "session_id", "participation_grant_id", "round_key", "round_number", "action_kind",
           "payload", "score_result", "created_at")
        SELECT ${randomUUID()}, e."event_id", e."session_id", e."participation_grant_id",
          ${input.roundKey}, ${input.roundNumber}, ${input.actionKind}, ${JSON.stringify(input.payload)}::jsonb,
          ${JSON.stringify({
            points: input.points,
            isCorrect: input.isCorrect,
            ...(input.result ? { result: input.result } : {}),
          })}::jsonb, ${input.createdAt}
        FROM actionable e
        ON CONFLICT ("session_id", "participation_grant_id", "round_key", "action_kind") DO NOTHING
        RETURNING "id", "event_id", "session_id", "participation_grant_id"
      ), scored AS (
        INSERT INTO "event_games"."score_ledger"
          ("id", "event_id", "session_id", "participation_grant_id", "source_event_id", "points", "reason", "created_at")
        SELECT ${randomUUID()}, i."event_id", i."session_id", i."participation_grant_id", i."id",
          ${input.points}, ${input.actionKind}, ${input.createdAt}
        FROM inserted i
        ON CONFLICT ("event_id", "session_id", "source_event_id") DO NOTHING
        RETURNING "source_event_id"
      )
      SELECT i."id" AS "submission_id"
      FROM inserted i
      JOIN scored sc ON sc."source_event_id" = i."id"
    `;
    if (!inserted[0]) return null;

    const totals = await transaction.prisma.$queryRaw<ParticipantTotalRow[]>`
      SELECT COALESCE(SUM("points"), 0)::int AS "score"
      FROM "event_games"."score_ledger"
      WHERE "event_id" = ${input.eventId} AND "session_id" = ${input.sessionId}
        AND "participation_grant_id" = ${input.participationGrantId}
    `;
    return {
      points: totals[0]?.score ?? 0,
      ...(input.result ? { result: input.result } : {}),
    };
  }

  async getParticipantState(
    input: { eventId: string; sessionId: string; participationGrantId: string; roundKey: string | null },
    transaction: PrismTransactionContext,
  ): Promise<GameParticipantStateSummary> {
    const rows = await transaction.prisma.$queryRaw<ParticipantScoreRow[]>`
      SELECT
        (SELECT COALESCE(SUM(l."points"), 0)::integer
         FROM "event_games"."score_ledger" l
         WHERE l."event_id" = ${input.eventId} AND l."session_id" = ${input.sessionId}
           AND l."participation_grant_id" = ${input.participationGrantId}) AS "score",
        (${input.roundKey}::text IS NOT NULL AND EXISTS (
          SELECT 1 FROM "event_games"."submissions" s
          WHERE s."event_id" = ${input.eventId} AND s."session_id" = ${input.sessionId}
            AND s."participation_grant_id" = ${input.participationGrantId}
            AND s."round_key" = ${input.roundKey}
        )) AS "has_submitted",
        (${input.roundKey}::text IS NOT NULL AND EXISTS (
          SELECT 1 FROM "event_games"."submissions" s
          WHERE s."event_id" = ${input.eventId} AND s."session_id" = ${input.sessionId}
            AND s."participation_grant_id" = ${input.participationGrantId}
            AND s."round_key" = ${input.roundKey} AND s."action_kind" = 'vote'
        )) AS "has_voted",
        (SELECT s."score_result"->'result'
         FROM "event_games"."submissions" s
         WHERE s."event_id" = ${input.eventId} AND s."session_id" = ${input.sessionId}
           AND s."participation_grant_id" = ${input.participationGrantId}
           AND s."round_key" = ${input.roundKey}
           AND s."score_result"->'result'->>'kind' = 'singleplayer-choice'
         ORDER BY s."created_at" DESC, s."id" DESC LIMIT 1) AS "result"
    `;
    const row = rows[0];
    if (!row) return { score: null, hasSubmitted: false };
    const result = participantChoiceResult(row.result);
    return {
      score: row.score,
      hasSubmitted: row.has_submitted,
      hasVoted: row.has_voted,
      ...(result ? { result } : {}),
    };
  }

  async getRoundVoteCounts(
    input: { eventId: string; sessionId: string; roundKey: string },
    transaction: PrismTransactionContext,
  ): Promise<Array<{ label: string; count: number }>> {
    const rows = await transaction.prisma.$queryRaw<VoteCountRow[]>`
      SELECT s."payload"->>'option' AS "label", COUNT(*)::integer AS "count"
      FROM "event_games"."submissions" s
      WHERE s."event_id" = ${input.eventId} AND s."session_id" = ${input.sessionId}
        AND s."round_key" = ${input.roundKey} AND s."action_kind" = 'vote'
        AND s."payload" ? 'option'
        AND COALESCE((
          SELECT m."action" FROM "event_games"."moderation_actions" m
          WHERE m."event_id" = s."event_id" AND m."session_id" = s."session_id"
            AND m."submission_id" = s."id"
          ORDER BY m."created_at" DESC, m."id" DESC LIMIT 1
        ), 'approve_submission') <> 'hide_submission'
      GROUP BY s."payload"->>'option'
      ORDER BY s."payload"->>'option'
    `;
    return rows.filter((row) => typeof row.label === 'string' && Number.isSafeInteger(row.count) && row.count >= 0);
  }

  async getRoundModerationQueue(
    input: { eventId: string; sessionId: string; roundKey: string },
    transaction: PrismTransactionContext,
  ): Promise<Array<{ id: string; roundNumber: number; response: string }>> {
    const rows = await transaction.prisma.$queryRaw<RoundModerationQueueRow[]>`
      SELECT s."id", s."round_number", s."payload"->>'response' AS "response"
      FROM "event_games"."submissions" s
      LEFT JOIN LATERAL (
        SELECT m."action" FROM "event_games"."moderation_actions" m
        WHERE m."event_id" = s."event_id" AND m."session_id" = s."session_id"
          AND m."submission_id" = s."id"
        ORDER BY m."created_at" DESC, m."id" DESC LIMIT 1
      ) latest ON TRUE
      WHERE s."event_id" = ${input.eventId} AND s."session_id" = ${input.sessionId}
        AND s."round_key" = ${input.roundKey} AND s."action_kind" = 'answer'
        AND s."payload" ? 'response' AND latest."action" IS NULL
        AND LENGTH(s."payload"->>'response') BETWEEN 1 AND 500
      ORDER BY s."created_at" ASC, s."id" ASC
      LIMIT 100
    `;
    return rows.filter((row) => typeof row.id === 'string' && Number.isSafeInteger(row.round_number)
      && row.round_number > 0 && typeof row.response === 'string' && row.response.length > 0 && row.response.length <= 500)
      .map((row) => ({ id: row.id, roundNumber: row.round_number, response: row.response as string }));
  }

  async getFamilyFeudModerationQueue(
    input: { eventId: string; sessionId: string; roundKey: string },
    transaction: PrismTransactionContext,
  ): Promise<Array<{ id: string; roundNumber: number; answer: string }>> {
    const rows = await transaction.prisma.$queryRaw<FamilyFeudModerationQueueRow[]>`
      SELECT s."id", s."round_number", s."payload"->>'answer' AS "answer"
      FROM "event_games"."submissions" s
      JOIN "event_games"."game_sessions" session
        ON session."event_id" = s."event_id" AND session."id" = s."session_id"
      JOIN "event_games"."game_definitions" definition
        ON definition."event_id" = session."event_id" AND definition."id" = session."game_definition_id"
      LEFT JOIN LATERAL (
        SELECT m."action" FROM "event_games"."moderation_actions" m
        WHERE m."event_id" = s."event_id" AND m."session_id" = s."session_id"
          AND m."submission_id" = s."id"
        ORDER BY m."created_at" DESC, m."id" DESC LIMIT 1
      ) latest ON TRUE
      WHERE s."event_id" = ${input.eventId} AND s."session_id" = ${input.sessionId}
        AND definition."game_kind" = 'family-feud'
        AND s."round_key" = ${input.roundKey} AND s."action_kind" = 'answer'
        AND s."payload" ? 'answer' AND s."score_result"->>'points' = '0'
        AND latest."action" IS NULL
        AND LENGTH(s."payload"->>'answer') BETWEEN 1 AND 120
      ORDER BY s."created_at" ASC, s."id" ASC
      LIMIT 100
    `;
    return rows.filter((row) => typeof row.id === 'string' && Number.isSafeInteger(row.round_number)
      && row.round_number > 0 && typeof row.answer === 'string' && row.answer.length > 0 && row.answer.length <= 120)
      .map((row) => ({ id: row.id, roundNumber: row.round_number, answer: row.answer as string }));
  }

  async getApprovedRoundResponses(
    input: { eventId: string; sessionId: string; roundKey: string },
    transaction: PrismTransactionContext,
  ): Promise<string[]> {
    const rows = await transaction.prisma.$queryRaw<ApprovedRoundResponseRow[]>`
      SELECT s."payload"->>'response' AS "response"
      FROM "event_games"."submissions" s
      JOIN LATERAL (
        SELECT m."action" FROM "event_games"."moderation_actions" m
        WHERE m."event_id" = s."event_id" AND m."session_id" = s."session_id"
          AND m."submission_id" = s."id"
        ORDER BY m."created_at" DESC, m."id" DESC LIMIT 1
      ) latest ON latest."action" = 'approve_submission'
      WHERE s."event_id" = ${input.eventId} AND s."session_id" = ${input.sessionId}
        AND s."round_key" = ${input.roundKey} AND s."action_kind" = 'answer'
        AND s."payload" ? 'response'
        AND LENGTH(s."payload"->>'response') BETWEEN 1 AND 500
      ORDER BY s."created_at" ASC, s."id" ASC
      LIMIT 100
    `;
    return rows.flatMap((row) => typeof row.response === 'string' && row.response.length > 0 && row.response.length <= 500
      ? [row.response]
      : []);
  }

  async listResponseHistory(
    input: {
      eventId: string;
      sessionId: string;
      archivedAt: Date | null;
      now: Date;
      limit: number;
      cursor: { createdAt: Date; id: string } | null;
    },
    transaction: PrismTransactionContext,
  ): Promise<GameResponseHistoryPage | null> {
    const session = await transaction.prisma.$queryRaw<SessionExistsRow[]>`
      SELECT EXISTS (
        SELECT 1 FROM "event_games"."game_sessions"
        WHERE "event_id" = ${input.eventId} AND "id" = ${input.sessionId}
      ) AS "exists"
    `;
    if (!session[0]?.exists) return null;

    const rows = await transaction.prisma.$queryRaw<GameResponseRow[]>`
      SELECT s."id", s."round_number", g."id" AS "participation_grant_id",
        s."payload",
        CASE
          WHEN latest."action" = 'approve_submission' THEN 'visible'
          WHEN latest."action" = 'hide_submission' THEN 'hidden'
          WHEN latest."action" = 'resolve_family_feud_answer' AND latest."resolved_answer" IS NOT NULL THEN 'visible'
          WHEN latest."action" = 'resolve_family_feud_answer' THEN 'hidden'
          ELSE 'pending'
        END AS "moderation_action",
        s."score_result", s."created_at"
      FROM "event_games"."submissions" s
      JOIN "event_games"."session_participation_grants" g
        ON g."event_id" = s."event_id" AND g."session_id" = s."session_id"
          AND g."id" = s."participation_grant_id"
      LEFT JOIN LATERAL (
        SELECT m."action", m."created_at", m."resolved_answer"
        FROM "event_games"."moderation_actions" m
        WHERE m."event_id" = s."event_id" AND m."session_id" = s."session_id"
          AND m."submission_id" = s."id"
        ORDER BY m."created_at" DESC, m."id" DESC LIMIT 1
      ) latest ON TRUE
      WHERE s."event_id" = ${input.eventId} AND s."session_id" = ${input.sessionId}
        AND (COALESCE(latest."created_at", ${input.archivedAt}::timestamptz) IS NULL
          OR COALESCE(latest."created_at", ${input.archivedAt}::timestamptz) > ${input.now} - INTERVAL '1 year')
        AND (${input.cursor?.createdAt ?? null}::timestamptz IS NULL
          OR s."created_at" < ${input.cursor?.createdAt ?? null}
          OR (s."created_at" = ${input.cursor?.createdAt ?? null} AND s."id" < ${input.cursor?.id ?? null}))
      ORDER BY s."created_at" DESC, s."id" DESC
      LIMIT ${input.limit + 1}
    `;
    const hasMore = rows.length > input.limit;
    const retained = rows.slice(0, input.limit).map((row): StoredGameResponse => {
      const response = responsePayload(row.payload);
      const score = row.score_result === null ? null : responseScoreSchema.parse(row.score_result).points;
      const moderationStatus = row.moderation_action === 'visible' || row.moderation_action === 'hidden'
        ? row.moderation_action
        : 'pending';
      if (!Number.isSafeInteger(row.round_number) || row.round_number < 1) {
        throw new Error('Persisted game response round is invalid');
      }
      return {
        id: row.id,
        roundNumber: row.round_number,
        participantAlias: createAnonymousGameParticipantAlias(row.participation_grant_id),
        response,
        moderationStatus,
        scoreAwarded: score,
        submittedAt: row.created_at,
      };
    });
    return { items: retained, hasMore };
  }

  async listResponseRetentionEventIds(now: Date, transaction: PrismTransactionContext): Promise<string[]> {
    const rows = await transaction.prisma.$queryRaw<Array<{ event_id: string }>>`
      SELECT DISTINCT "event_id"
      FROM "event_games"."submissions"
      WHERE "created_at" <= ${now}::timestamptz - INTERVAL '1 year'
        AND "payload" <> '{"redacted":true}'::jsonb
      ORDER BY "event_id"
    `;
    return rows.map(({ event_id }) => event_id);
  }

  async redactExpiredResponses(
    input: { eventId: string; archivedAt: Date | null; now: Date },
    transaction: PrismTransactionContext,
  ): Promise<number> {
    const rows = await transaction.prisma.$queryRaw<RedactedCountRow[]>`
      WITH latest_moderation AS (
        SELECT DISTINCT ON (m."submission_id") m."submission_id", m."created_at"
        FROM "event_games"."moderation_actions" m
        WHERE m."event_id" = ${input.eventId}
        ORDER BY m."submission_id", m."created_at" DESC, m."id" DESC
      ), expired AS (
        SELECT s."event_id", s."session_id", s."id"
        FROM "event_games"."submissions" s
        LEFT JOIN latest_moderation latest ON latest."submission_id" = s."id"
        WHERE s."event_id" = ${input.eventId}
          AND s."payload" <> '{"redacted":true}'::jsonb
          AND COALESCE(latest."created_at", ${input.archivedAt}::timestamptz) IS NOT NULL
          AND COALESCE(latest."created_at", ${input.archivedAt}::timestamptz) <= ${input.now} - INTERVAL '1 year'
      ), cleared_submissions AS (
        UPDATE "event_games"."submissions" s
        SET "payload" = '{"redacted":true}'::jsonb, "score_result" = NULL
        FROM expired e
        WHERE s."event_id" = e."event_id" AND s."session_id" = e."session_id" AND s."id" = e."id"
        RETURNING s."event_id", s."session_id", s."id"
      ), cleared_moderation AS (
        UPDATE "event_games"."moderation_actions" m
        SET "reason" = NULL,
          "resolved_answer" = CASE WHEN m."resolved_answer" IS NULL THEN NULL ELSE '' END
        FROM cleared_submissions s
        WHERE m."event_id" = s."event_id" AND m."session_id" = s."session_id"
          AND m."submission_id" = s."id"
        RETURNING m."id"
      )
      SELECT COUNT(*)::integer AS "redacted_count" FROM cleared_submissions
    `;
    return rows[0]?.redacted_count ?? 0;
  }
}
