import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismAssignEventGameAwardInput, PrismEventGameAward } from '@prism/types';
import type { GameAwardStorePort } from '../contracts/game-award-store.port';

interface SessionStatusRow { status: string }
interface RecipientRow {
  participation_grant_id: string | null;
  team_id: string | null;
  label: string;
}
interface AwardRow {
  id: string;
  session_id: string;
  recipient_type: string;
  recipient_key: string;
  recipient_label: string;
  award_kind: string;
  label: string;
  points: number | null;
  prize_reference: string | null;
  created_at: Date;
  assigned_by: string;
}
interface InsertedAwardRow { id: string }

function recipientFields(request: PrismAssignEventGameAwardInput) {
  return request.recipient.type === 'participant'
    ? {
      recipientType: 'participant',
      recipientKey: `participant:${request.recipient.participationGrantId}`,
      participationGrantId: request.recipient.participationGrantId,
      teamId: null,
    }
    : {
      recipientType: 'team',
      recipientKey: `team:${request.recipient.teamId}`,
      participationGrantId: null,
      teamId: request.recipient.teamId,
    };
}

function mapAward(row: AwardRow): PrismEventGameAward {
  if (!['participant', 'team'].includes(row.recipient_type) || !['points', 'badge', 'prize'].includes(row.award_kind)) {
    throw new Error('Persisted game award is invalid');
  }
  return {
    id: row.id,
    sessionId: row.session_id,
    recipientType: row.recipient_type as PrismEventGameAward['recipientType'],
    recipientLabel: row.recipient_label,
    awardKind: row.award_kind as PrismEventGameAward['awardKind'],
    label: row.label,
    points: row.points,
    prizeReference: row.prize_reference,
    assignedAt: row.created_at.toISOString(),
  };
}

@Injectable()
export class EventGamesAwardPrismaStoreAdapter implements GameAwardStorePort {
  async assignAward(
    input: { eventId: string; sessionId: string; actorId: string; request: PrismAssignEventGameAwardInput; now: Date },
    transaction: PrismTransactionContext,
  ): Promise<PrismEventGameAward | null> {
    const session = await transaction.prisma.$queryRaw<SessionStatusRow[]>`
      SELECT "status" FROM "event_games"."game_sessions"
      WHERE "event_id" = ${input.eventId} AND "id" = ${input.sessionId}
      FOR UPDATE
    `;
    if (!session[0] || !['live', 'completed'].includes(session[0].status)) return null;

    const recipient = recipientFields(input.request);
    const sourceEventId = this.sourceEventId(input, recipient.recipientKey);
    if (!sourceEventId) return null;

    const target = await this.findRecipient(input, transaction);
    if (!target) return null;
    const existing = await transaction.prisma.$queryRaw<AwardRow[]>`
      SELECT a."id", a."session_id", a."recipient_type", a."recipient_key", ${target.label}::text AS "recipient_label",
        a."award_kind", a."label", a."points", a."prize_reference", a."created_at", a."assigned_by"
      FROM "event_games"."awards" a
      WHERE a."event_id" = ${input.eventId} AND a."session_id" = ${input.sessionId}
        AND a."source_event_id" = ${sourceEventId} AND a."recipient_key" = ${recipient.recipientKey}
    `;
    if (existing[0]) return this.replay(existing[0], input, target.label, recipient);

    const awardId = randomUUID();
    const rows = await transaction.prisma.$queryRaw<InsertedAwardRow[]>`
      WITH inserted AS (
        INSERT INTO "event_games"."awards"
          ("id", "event_id", "session_id", "recipient_type", "recipient_key", "participation_grant_id", "team_id",
           "award_kind", "label", "points", "prize_reference", "assigned_by", "source_event_id", "created_at")
        VALUES (${awardId}, ${input.eventId}, ${input.sessionId}, ${recipient.recipientType}, ${recipient.recipientKey},
          ${recipient.participationGrantId}, ${recipient.teamId}, ${input.request.awardKind}, ${input.request.label},
          ${input.request.points ?? null}, ${input.request.prizeReference ?? null}, ${input.actorId}, ${sourceEventId}, ${input.now})
        ON CONFLICT ("event_id", "session_id", "source_event_id", "recipient_key") DO NOTHING
        RETURNING *
      ), scored AS (
        INSERT INTO "event_games"."score_ledger"
          ("id", "event_id", "session_id", "participation_grant_id", "source_event_id", "points", "reason", "created_at")
        SELECT ${randomUUID()}, i."event_id", i."session_id", i."participation_grant_id", i."source_event_id",
          i."points", 'host-award:' || i."label", i."created_at"
        FROM inserted i
        WHERE i."recipient_type" = 'participant' AND i."award_kind" = 'points'
        ON CONFLICT ("event_id", "session_id", "source_event_id") DO NOTHING
        RETURNING "source_event_id"
      )
      SELECT i."id" FROM inserted i
      WHERE i."award_kind" <> 'points' OR i."recipient_type" = 'team' OR EXISTS (
        SELECT 1 FROM scored WHERE scored."source_event_id" = i."source_event_id"
      )
    `;
    if (!rows[0]) return null;

    return {
      id: rows[0].id,
      sessionId: input.sessionId,
      recipientType: recipient.recipientType as PrismEventGameAward['recipientType'],
      recipientLabel: target.label,
      awardKind: input.request.awardKind,
      label: input.request.label,
      points: input.request.points ?? null,
      prizeReference: input.request.prizeReference ?? null,
      assignedAt: input.now.toISOString(),
    };
  }

  private sourceEventId(
    input: { eventId: string; sessionId: string; actorId: string; request: PrismAssignEventGameAwardInput },
    recipientKey: string,
  ) {
    return createHash('sha256')
      .update(`event-game:award:v1\0${input.eventId}\0${input.sessionId}\0${input.actorId}\0${input.request.idempotencyKey}\0${recipientKey}`)
      .digest('hex');
  }

  private async findRecipient(
    input: { eventId: string; sessionId: string; request: PrismAssignEventGameAwardInput },
    transaction: PrismTransactionContext,
  ): Promise<RecipientRow | null> {
    if (input.request.recipient.type === 'participant') {
      const rows = await transaction.prisma.$queryRaw<RecipientRow[]>`
        SELECT g."id" AS "participation_grant_id", g."team_id", COALESCE(g."team_label", 'Player ' || participant."number") AS "label"
        FROM "event_games"."session_participation_grants" g
        JOIN LATERAL (
          SELECT COUNT(*)::integer + 1 AS "number"
          FROM "event_games"."session_participation_grants" prior
          WHERE prior."event_id" = g."event_id" AND prior."session_id" = g."session_id"
            AND (prior."granted_at", prior."id") < (g."granted_at", g."id")
        ) participant ON TRUE
        WHERE g."event_id" = ${input.eventId} AND g."session_id" = ${input.sessionId}
          AND g."id" = ${input.request.recipient.participationGrantId} AND g."revoked_at" IS NULL
      `;
      const row = rows[0];
      return row ? { ...row, team_id: null } : null;
    }

    const rows = await transaction.prisma.$queryRaw<RecipientRow[]>`
      SELECT NULL::text AS "participation_grant_id", g."team_id", MIN(g."team_label") AS "label"
      FROM "event_games"."session_participation_grants" g
      WHERE g."event_id" = ${input.eventId} AND g."session_id" = ${input.sessionId}
        AND g."team_id" = ${input.request.recipient.teamId} AND g."revoked_at" IS NULL
      GROUP BY g."team_id"
      HAVING COUNT(DISTINCT g."team_label") = 1
    `;
    return rows[0] ?? null;
  }

  private replay(
    row: AwardRow,
    input: { request: PrismAssignEventGameAwardInput },
    label: string,
    recipient: ReturnType<typeof recipientFields>,
  ): PrismEventGameAward | null {
    if (
      row.recipient_type !== recipient.recipientType || row.label !== input.request.label ||
      row.award_kind !== input.request.awardKind || row.points !== (input.request.points ?? null) ||
      row.prize_reference !== (input.request.prizeReference ?? null)
    ) return null;
    return mapAward({ ...row, recipient_label: label });
  }
}
