import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import {
  eventGameTemplateConfigurationSchema,
  type PrismEventGameTemplateConfiguration,
  type PrismModerateEventGameInput,
} from '@prism/types';
import { z } from 'zod';
import type {
  GameModerationStorePort,
  PersistedGameModeration,
} from '../contracts/game-moderation-store.port';

interface SessionStatusRow { status: string; game_kind: string; config_snapshot: unknown }
interface ExistingModerationRow {
  id: string;
  action: string;
  submission_id: string | null;
  participation_grant_id: string | null;
  reason: string | null;
  resolved_answer: string | null;
}
interface SubmissionTargetRow { id: string; moderation_action: string | null }
interface FamilyFeudSubmissionRow {
  id: string;
  round_key: string;
  action_kind: string;
  payload: unknown;
  score_result: unknown;
  participation_grant_id: string;
  moderation_action: string | null;
}
interface ParticipantTargetRow { id: string; revoked_at: Date | null }
interface InsertedRow { id: string }
type FamilyFeudConfiguration = Extract<PrismEventGameTemplateConfiguration, { kind: 'family-feud' }>;

const familyFeudScoreResultSchema = z.object({
  points: z.number().int().nonnegative(),
  isCorrect: z.boolean(),
}).passthrough();
const familyFeudAnswerPayloadSchema = z.object({ answer: z.string().trim().min(1).max(120) }).passthrough();

function familyFeudConfiguration(snapshot: unknown): FamilyFeudConfiguration | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const parsed = eventGameTemplateConfigurationSchema.safeParse((snapshot as Record<string, unknown>).configuration);
  return parsed.success && parsed.data.kind === 'family-feud' ? parsed.data : null;
}

function isPendingUnscoredFamilyFeudAnswer(
  target: FamilyFeudSubmissionRow | undefined,
  roundKey: string,
): target is FamilyFeudSubmissionRow {
  if (!target || target.round_key !== roundKey || target.action_kind !== 'answer' || target.moderation_action !== null) return false;
  const payload = familyFeudAnswerPayloadSchema.safeParse(target.payload);
  const score = familyFeudScoreResultSchema.safeParse(target.score_result);
  return payload.success && score.success && score.data.points === 0 && !score.data.isCorrect;
}

function familyFeudResolution(
  round: FamilyFeudConfiguration['rounds'][number],
  boardAnswer: string | null,
): { points: number; resolvedAnswer: string | null } | null {
  if (boardAnswer === null) return { points: 0, resolvedAnswer: null };
  const answer = round.answers.find((item) => item.answer === boardAnswer);
  return answer ? { points: answer.points, resolvedAnswer: answer.answer } : null;
}

function statusAfter(request: PrismModerateEventGameInput): PersistedGameModeration['afterStatus'] {
  if (request.action === 'approve_submission') return 'visible';
  if (request.action === 'hide_submission') return 'hidden';
  if (request.action === 'resolve_family_feud_answer') return request.boardAnswer === null ? 'hidden' : 'visible';
  return 'revoked';
}

function statusBefore(action: string | null): PersistedGameModeration['beforeStatus'] {
  if (action === 'approve_submission') return 'visible';
  if (action === 'hide_submission') return 'hidden';
  return 'pending';
}

function idempotentId(input: {
  eventId: string;
  sessionId: string;
  actorId: string;
  key: string;
}) {
  const digest = createHash('sha256')
    .update(`event-game:moderation:v1\0${input.eventId}\0${input.sessionId}\0${input.actorId}\0${input.key}`)
    .digest('hex');
  return `moderation_${digest}`;
}

@Injectable()
export class EventGamesModerationPrismaStoreAdapter implements GameModerationStorePort {
  async applyModeration(
    input: { eventId: string; sessionId: string; actorId: string; request: PrismModerateEventGameInput; now: Date },
    transaction: PrismTransactionContext,
  ): Promise<PersistedGameModeration | null> {
    const id = idempotentId({
      eventId: input.eventId, sessionId: input.sessionId, actorId: input.actorId,
      key: input.request.idempotencyKey,
    });
    const sessions = await transaction.prisma.$queryRaw<SessionStatusRow[]>`
      SELECT s."status", d."game_kind", s."config_snapshot"
      FROM "event_games"."game_sessions" s
      JOIN "event_games"."game_definitions" d
        ON d."event_id" = s."event_id" AND d."id" = s."game_definition_id"
      WHERE s."event_id" = ${input.eventId} AND s."id" = ${input.sessionId}
      FOR UPDATE OF s
    `;
    const session = sessions[0];
    if (!session || !['live', 'paused', 'completed'].includes(session.status)) return null;

    const existing = await transaction.prisma.$queryRaw<ExistingModerationRow[]>`
      SELECT "id", "action", "submission_id", "participation_grant_id", "reason", "resolved_answer"
      FROM "event_games"."moderation_actions" WHERE "id" = ${id}
    `;
    if (existing[0]) return this.replay(existing[0], input);

    if (input.request.action === 'remove_participant') {
      return this.removeParticipant(id, input, transaction);
    }
    if (input.request.action === 'resolve_family_feud_answer') {
      return this.resolveFamilyFeudAnswer(id, input, session, transaction);
    }

    return this.moderateSubmission(id, input, transaction);
  }

  private async resolveFamilyFeudAnswer(
    id: string,
    input: Parameters<GameModerationStorePort['applyModeration']>[0],
    session: SessionStatusRow,
    transaction: PrismTransactionContext,
  ): Promise<PersistedGameModeration | null> {
    if (input.request.action !== 'resolve_family_feud_answer'
      || session.game_kind !== 'family-feud' || !['live', 'paused'].includes(session.status)) return null;
    const request = input.request;
    const configuration = familyFeudConfiguration(session.config_snapshot);
    if (!configuration) return null;
    const target = await this.findFamilyFeudSubmission(input, request, transaction);
    if (!isPendingUnscoredFamilyFeudAnswer(target, target?.round_key ?? '')) return null;
    const round = configuration.rounds.find(({ key }) => key === target.round_key);
    if (!round) return null;
    const resolution = familyFeudResolution(round, request.boardAnswer);
    if (!resolution) return null;

    const updated = await this.applyFamilyFeudScore(input, target, resolution.points, transaction);
    if (!updated) return null;
    const inserted = await this.insertAction(id, input, null, target.id, transaction, resolution.resolvedAnswer);
    if (!inserted) throw new ConflictException('Game moderation request was already recorded');
    return {
      id,
      targetId: target.id,
      beforeStatus: 'pending',
      afterStatus: statusAfter(request),
    };
  }

  private async findFamilyFeudSubmission(
    input: Parameters<GameModerationStorePort['applyModeration']>[0],
    request: Extract<PrismModerateEventGameInput, { action: 'resolve_family_feud_answer' }>,
    transaction: PrismTransactionContext,
  ) {
    return (await transaction.prisma.$queryRaw<FamilyFeudSubmissionRow[]>`
      SELECT s."id", s."round_key", s."action_kind", s."payload", s."score_result",
        s."participation_grant_id", latest."action" AS "moderation_action"
      FROM "event_games"."submissions" s
      LEFT JOIN LATERAL (
        SELECT m."action" FROM "event_games"."moderation_actions" m
        WHERE m."event_id" = s."event_id" AND m."session_id" = s."session_id"
          AND m."submission_id" = s."id"
        ORDER BY m."created_at" DESC, m."id" DESC LIMIT 1
      ) latest ON TRUE
      WHERE s."event_id" = ${input.eventId} AND s."session_id" = ${input.sessionId}
        AND s."id" = ${request.submissionId}
      FOR UPDATE OF s
    `)[0];
  }

  private async applyFamilyFeudScore(
    input: Parameters<GameModerationStorePort['applyModeration']>[0],
    target: FamilyFeudSubmissionRow,
    points: number,
    transaction: PrismTransactionContext,
  ) {
    const scored = await transaction.prisma.$queryRaw<InsertedRow[]>`
      UPDATE "event_games"."score_ledger"
      SET "points" = ${points}, "reason" = 'family-feud-adjudication'
      WHERE "event_id" = ${input.eventId} AND "session_id" = ${input.sessionId}
        AND "participation_grant_id" = ${target.participation_grant_id}
        AND "source_event_id" = ${target.id}
      RETURNING "id"
    `;
    if (!scored[0]) return null;
    const updated = await transaction.prisma.$queryRaw<InsertedRow[]>`
      UPDATE "event_games"."submissions"
      SET "score_result" = ${JSON.stringify({ points, isCorrect: points > 0 })}::jsonb
      WHERE "event_id" = ${input.eventId} AND "session_id" = ${input.sessionId}
        AND "id" = ${target.id} AND "score_result"->>'points' = '0'
      RETURNING "id"
    `;
    if (!updated[0]) throw new ConflictException('Family Feud answer is no longer awaiting adjudication');
    return updated[0];
  }

  private async removeParticipant(
    id: string,
    input: Parameters<GameModerationStorePort['applyModeration']>[0],
    transaction: PrismTransactionContext,
  ): Promise<PersistedGameModeration | null> {
    if (input.request.action !== 'remove_participant') return null;
    const grantId = input.request.participationGrantId;
    const targets = await transaction.prisma.$queryRaw<ParticipantTargetRow[]>`
      SELECT "id", "revoked_at" FROM "event_games"."session_participation_grants"
      WHERE "event_id" = ${input.eventId} AND "session_id" = ${input.sessionId} AND "id" = ${grantId}
      FOR UPDATE
    `;
    const target = targets[0];
    if (!target || target.revoked_at) return null;
    const changed = await transaction.prisma.$queryRaw<InsertedRow[]>`
      UPDATE "event_games"."session_participation_grants"
      SET "revoked_at" = ${input.now}, "revoked_by" = ${input.actorId}
      WHERE "event_id" = ${input.eventId} AND "session_id" = ${input.sessionId}
        AND "id" = ${grantId} AND "revoked_at" IS NULL
      RETURNING "id"
    `;
    if (!changed[0]) return null;
    const inserted = await this.insertAction(id, input, grantId, null, transaction);
    if (!inserted) throw new ConflictException('Game moderation request was already recorded');
    return { id, targetId: grantId, beforeStatus: 'active', afterStatus: 'revoked' };
  }

  private async moderateSubmission(
    id: string,
    input: Parameters<GameModerationStorePort['applyModeration']>[0],
    transaction: PrismTransactionContext,
  ): Promise<PersistedGameModeration | null> {
    if (input.request.action === 'remove_participant') return null;
    const submissionId = input.request.submissionId;
    const targets = await transaction.prisma.$queryRaw<SubmissionTargetRow[]>`
      SELECT s."id", latest."action" AS "moderation_action"
      FROM "event_games"."submissions" s
      LEFT JOIN LATERAL (
        SELECT m."action" FROM "event_games"."moderation_actions" m
        WHERE m."event_id" = s."event_id" AND m."session_id" = s."session_id"
          AND m."submission_id" = s."id"
        ORDER BY m."created_at" DESC, m."id" DESC LIMIT 1
      ) latest ON TRUE
      WHERE s."event_id" = ${input.eventId} AND s."session_id" = ${input.sessionId}
        AND s."id" = ${submissionId}
      FOR UPDATE OF s
    `;
    const target = targets[0];
    if (!target) return null;
    const inserted = await this.insertAction(id, input, null, submissionId, transaction);
    if (!inserted) throw new ConflictException('Game moderation request was already recorded');
    const beforeStatus = target.moderation_action
      ? statusBefore(target.moderation_action)
      : 'pending';
    return { id, targetId: submissionId, beforeStatus, afterStatus: statusAfter(input.request) };
  }

  private async insertAction(
    id: string,
    input: { eventId: string; sessionId: string; actorId: string; request: PrismModerateEventGameInput; now: Date },
    participationGrantId: string | null,
    submissionId: string | null,
    transaction: PrismTransactionContext,
    resolvedAnswer: string | null = null,
  ) {
    const rows = await transaction.prisma.$queryRaw<InsertedRow[]>`
      INSERT INTO "event_games"."moderation_actions"
        ("id", "event_id", "session_id", "submission_id", "participation_grant_id", "action", "reason", "resolved_answer", "actor_id", "created_at")
      VALUES (${id}, ${input.eventId}, ${input.sessionId}, ${submissionId}, ${participationGrantId},
        ${input.request.action}, ${'reason' in input.request ? input.request.reason ?? null : null}, ${resolvedAnswer}, ${input.actorId}, ${input.now})
      RETURNING "id"
    `;
    return rows[0] ?? null;
  }

  private replay(
    existing: ExistingModerationRow,
    input: { eventId: string; sessionId: string; actorId: string; request: PrismModerateEventGameInput; now: Date },
  ): PersistedGameModeration | null {
    const request = input.request;
    const sameTarget = request.action === 'remove_participant'
      ? existing.participation_grant_id === request.participationGrantId && existing.submission_id === null
      : existing.submission_id === request.submissionId && existing.participation_grant_id === null;
    const sameDecision = request.action === 'resolve_family_feud_answer'
      ? existing.resolved_answer === request.boardAnswer
      : existing.reason === ('reason' in request ? request.reason ?? null : null);
    if (!sameTarget || existing.action !== request.action || !sameDecision) return null;
    return {
      id: existing.id,
      targetId: existing.submission_id ?? existing.participation_grant_id ?? '',
      beforeStatus: request.action === 'remove_participant' ? 'active' : 'pending',
      afterStatus: statusAfter(request),
    };
  }
}
