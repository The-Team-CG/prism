import { ConflictException, Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { eventGameLobbyBrandingSettingsSchema, eventGameParticipantResultSchema, prismEventGameBrandThemeSchema } from '@prism/types';
import { z } from 'zod';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { GameHostCommandInput, GameHostMutationOutcome, GameHostAction, GamePersistencePort, PersistedGameHostCommand } from '../contracts/game-persistence.port';
import { GAME_PIN_STORE, type GamePinStorePort } from '../contracts/game-pin-store.port';
import { GAME_SCHEDULER, type GameSchedulerPort } from '../contracts/game-scheduler.port';

interface TransitionRow {
  event_id: string;
  session_id: string;
  before_status: string;
  after_status: string;
}

interface LobbySlugRow { event_id: string; lobby_slug: string }
interface RoundAdvanceRow { event_id: string; session_id: string; status: string }
interface WheelResultRow { event_id: string; session_id: string; status: string; wheel_result?: unknown }

const advanceRoundCommandSchema = z.object({
  expectedRoundKey: z.string().regex(/^[A-Za-z0-9:_-]{1,120}$/),
  advanceByMs: z.number().int().min(1).max(600_000),
  expectedRoundOffsetMs: z.number().int().min(0),
  expectedStatus: z.enum(['live', 'paused']),
  expectedStartedAt: z.string().datetime({ offset: true }),
  expectedPausedAt: z.string().datetime({ offset: true }).nullable(),
  expectedTotalPausedMs: z.number().int().min(0),
}).strict();

type AdvanceRoundCommand = z.infer<typeof advanceRoundCommandSchema>;

interface HostTransition {
  action: GameHostAction;
  allowedStatuses: readonly string[];
  nextStatus: string;
  outcome: GameHostMutationOutcome;
}

const SESSION_TRANSITIONS: Partial<Record<GameHostAction, HostTransition>> = {
  start_session: { action: 'start_session', allowedStatuses: ['scheduled', 'lobby'], nextStatus: 'live', outcome: 'started' },
  pause_session: { action: 'pause_session', allowedStatuses: ['live'], nextStatus: 'paused', outcome: 'paused' },
  resume_session: { action: 'resume_session', allowedStatuses: ['paused'], nextStatus: 'live', outcome: 'resumed' },
  end_session: { action: 'end_session', allowedStatuses: ['scheduled', 'lobby', 'live', 'paused'], nextStatus: 'completed', outcome: 'ended' },
  cancel_session: { action: 'cancel_session', allowedStatuses: ['scheduled', 'lobby'], nextStatus: 'cancelled', outcome: 'cancelled' },
};

@Injectable()
export class EventGamesPersistenceAdapter implements GamePersistencePort {
  constructor(
    @Inject(GAME_PIN_STORE) private readonly pins: GamePinStorePort,
    @Optional() @Inject(GAME_SCHEDULER) private readonly scheduler?: GameSchedulerPort,
  ) {}

  async executeHostCommand(input: GameHostCommandInput, transaction: PrismTransactionContext): Promise<PersistedGameHostCommand> {
    if (input.resourceType === 'lobby' && input.action === 'provision_lobby') {
      return this.provisionLobby(input, transaction);
    }
    if (input.resourceType === 'lobby' && input.action === 'update_lobby_branding') {
      return this.updateLobbyBranding(input, transaction);
    }

    if (input.resourceType !== 'session') {
      throw new ServiceUnavailableException('This event-game command is not available yet');
    }
    if (input.action === 'enable_joins') {
      return this.enableJoins(input, transaction);
    }
    if (input.action === 'disable_joins') {
      return this.disableJoins(input, transaction);
    }
    if (input.action === 'advance_round') {
      return this.advanceRound(input, transaction);
    }
    if (input.action === 'spin_wheel') {
      return this.spinWheel(input, transaction);
    }
    return this.transitionSession(input, transaction);
  }

  private async spinWheel(input: GameHostCommandInput, transaction: PrismTransactionContext): Promise<PersistedGameHostCommand> {
    const parsed = eventGameParticipantResultSchema.safeParse(input.command.wheelResult);
    if (!parsed.success || parsed.data.kind !== 'spin-wheel') {
      throw new ServiceUnavailableException('Spin the Wheel result is invalid');
    }

    const updated = await transaction.prisma.$queryRaw<WheelResultRow[]>`
      UPDATE "event_games"."game_sessions" s
      SET "wheel_result" = ${JSON.stringify(parsed.data)}::jsonb, "updated_at" = NOW()
      WHERE s."event_id" = ${input.eventId} AND s."id" = ${input.resourceId}
        AND s."status" = 'live' AND s."wheel_result" IS NULL
        AND EXISTS (
          SELECT 1 FROM "event_games"."game_definitions" d
          WHERE d."event_id" = s."event_id" AND d."id" = s."game_definition_id"
            AND d."game_kind" = 'spin-wheel'
        )
      RETURNING s."event_id", s."id" AS "session_id", s."status"
    `;
    if (updated[0]) {
      return this.wheelCommandResult(input, updated[0], 'spun');
    }

    const existing = await transaction.prisma.$queryRaw<WheelResultRow[]>`
      SELECT s."event_id", s."id" AS "session_id", s."status", s."wheel_result"
      FROM "event_games"."game_sessions" s
      JOIN "event_games"."game_definitions" d
        ON d."event_id" = s."event_id" AND d."id" = s."game_definition_id"
      WHERE s."event_id" = ${input.eventId} AND s."id" = ${input.resourceId}
        AND d."game_kind" = 'spin-wheel'
      FOR UPDATE OF s
    `;
    const row = existing[0];
    const storedResult = row ? eventGameParticipantResultSchema.safeParse(row.wheel_result) : null;
    if (!row || !storedResult?.success || storedResult.data.kind !== 'spin-wheel') {
      throw new ConflictException('Spin the Wheel is not in a state that accepts this command');
    }
    return this.wheelCommandResult(input, row, 'already_exists');
  }

  private wheelCommandResult(
    input: GameHostCommandInput,
    row: WheelResultRow,
    outcome: 'spun' | 'already_exists',
  ): PersistedGameHostCommand {
    const status = row.status;
    if (!['live', 'paused', 'completed', 'cancelled'].includes(status)) {
      throw new ConflictException('Spin the Wheel is not in a state that accepts this command');
    }
    return {
      eventId: row.event_id,
      resourceType: 'session',
      resourceId: row.session_id,
      action: input.action,
      outcome,
      resultId: row.session_id,
      requestReceiptId: input.requestReceiptId,
      transition: {
        beforeStatus: status as PersistedGameHostCommand['transition']['beforeStatus'],
        afterStatus: status as PersistedGameHostCommand['transition']['afterStatus'],
        beforeVersion: null,
        afterVersion: null,
      },
    };
  }

  private async advanceRound(input: GameHostCommandInput, transaction: PrismTransactionContext): Promise<PersistedGameHostCommand> {
    const command = parseAdvanceRoundCommand(input.command);
    const rows = await transaction.prisma.$queryRaw<RoundAdvanceRow[]>`
      UPDATE "event_games"."game_sessions"
      SET "round_offset_ms" = "round_offset_ms" + ${command.advanceByMs}, "updated_at" = NOW()
      WHERE "event_id" = ${input.eventId} AND "id" = ${input.resourceId}
        AND "status" = ${command.expectedStatus}
        AND "started_at" = ${command.expectedStartedAt}
        AND "paused_at" IS NOT DISTINCT FROM ${command.expectedPausedAt}
        AND "total_paused_ms" = ${command.expectedTotalPausedMs}::bigint
        AND "round_offset_ms" = ${command.expectedRoundOffsetMs}
      RETURNING "event_id", "id" AS "session_id", "status"
    `;
    const result = rows[0];
    if (!result) throw new ConflictException('Game round changed before it could be advanced');
    return {
      eventId: result.event_id,
      resourceType: 'session',
      resourceId: result.session_id,
      action: input.action,
      outcome: 'advanced',
      resultId: result.session_id,
      requestReceiptId: input.requestReceiptId,
      transition: {
        beforeStatus: result.status as PersistedGameHostCommand['transition']['beforeStatus'],
        afterStatus: result.status as PersistedGameHostCommand['transition']['afterStatus'],
        beforeVersion: null,
        afterVersion: null,
      },
    };
  }

  private async provisionLobby(input: GameHostCommandInput, transaction: PrismTransactionContext): Promise<PersistedGameHostCommand> {
    const lobbySlug = input.command.lobbySlug;
    if (typeof lobbySlug !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(lobbySlug) || input.resourceId !== input.eventId) {
      throw new ServiceUnavailableException('Event game lobby provisioning command is invalid');
    }
    const inserted = await transaction.prisma.$queryRaw<LobbySlugRow[]>`
      INSERT INTO "event_games"."lobby_slugs" ("event_id", "lobby_slug")
      VALUES (${input.eventId}, ${lobbySlug})
      ON CONFLICT ("event_id") DO NOTHING
      RETURNING "event_id", "lobby_slug"
    `;
    const existing = inserted[0] ?? (await transaction.prisma.$queryRaw<LobbySlugRow[]>`
      SELECT "event_id", "lobby_slug" FROM "event_games"."lobby_slugs"
      WHERE "event_id" = ${input.eventId} FOR UPDATE
    `)[0];
    if (!existing) throw new ConflictException('Could not provision the event game lobby');
    const created = inserted.length > 0;
    return {
      eventId: existing.event_id,
      resourceType: 'lobby' as const,
      resourceId: existing.event_id,
      action: input.action,
      outcome: created ? 'created' as const : 'already_exists' as const,
      resultId: existing.lobby_slug,
      requestReceiptId: input.requestReceiptId,
      transition: {
        beforeStatus: created ? null : 'published' as const,
        afterStatus: 'published' as const,
        beforeVersion: created ? null : 1,
        afterVersion: 1,
      },
    };
  }

  private async updateLobbyBranding(input: GameHostCommandInput, transaction: PrismTransactionContext): Promise<PersistedGameHostCommand> {
    const settings = eventGameLobbyBrandingSettingsSchema.safeParse(input.command);
    if (!settings.success || input.resourceId !== input.eventId) {
      throw new ServiceUnavailableException('Event game lobby branding command is invalid');
    }
    const existing = await transaction.prisma.$queryRaw<Array<{
      event_id: string; brand_theme: string; brand_primary_color: string | null;
      brand_secondary_color: string | null; brand_logo_object_id: string | null;
    }>>`
      SELECT "event_id", "brand_theme", "brand_primary_color", "brand_secondary_color", "brand_logo_object_id"
      FROM "event_games"."lobby_slugs"
      WHERE "event_id" = ${input.eventId} FOR UPDATE
    `;
    if (!existing[0]) throw new ConflictException('Create the event game lobby before updating its branding');
    const beforeTheme = prismEventGameBrandThemeSchema.parse(existing[0].brand_theme);
    const updated = await transaction.prisma.$queryRaw<Array<{ event_id: string; brand_theme: string }>>`
      UPDATE "event_games"."lobby_slugs"
      SET "brand_theme" = ${settings.data.theme},
          "brand_primary_color" = ${settings.data.primaryColor ?? null},
          "brand_secondary_color" = ${settings.data.secondaryColor ?? null},
          "brand_logo_object_id" = ${settings.data.logoObjectId ?? null},
          "brand_updated_at" = NOW(), "brand_updated_by" = ${input.actorId}
      WHERE "event_id" = ${input.eventId}
      RETURNING "event_id", "brand_theme"
    `;
    const row = updated[0];
    if (!row) throw new ConflictException('Event game lobby branding could not be updated');
    const afterTheme = prismEventGameBrandThemeSchema.parse(row.brand_theme);
    return {
      eventId: row.event_id,
      resourceType: 'lobby',
      resourceId: row.event_id,
      action: input.action,
      outcome: 'updated',
      resultId: afterTheme,
      requestReceiptId: input.requestReceiptId,
      transition: {
        beforeStatus: beforeTheme,
        afterStatus: afterTheme,
        beforeVersion: null,
        afterVersion: null,
      },
    };
  }

  private async enableJoins(input: GameHostCommandInput, transaction: PrismTransactionContext): Promise<PersistedGameHostCommand> {
    const issueCommand = this.parsePinIssueCommand(input.command);
    const issued = await this.pins.issueSessionPin({
      eventId: input.eventId,
      sessionId: input.resourceId,
      idempotencyKeyDigest: issueCommand.idempotencyKeyDigest,
      candidates: issueCommand.candidates,
      expiresAt: issueCommand.expiresAt,
      now: issueCommand.now,
      actorId: input.actorId,
    }, transaction);
    if (!issued) throw new ConflictException('This game session cannot accept a PIN');
    return {
      eventId: input.eventId,
      resourceType: 'session' as const,
      resourceId: input.resourceId,
      action: input.action,
      outcome: 'joins_enabled' as const,
      resultId: input.resourceId,
      requestReceiptId: input.requestReceiptId,
      generationAttempt: issued.generationAttempt,
      pinExpiresAt: issued.expiresAt,
      transition: {
        beforeStatus: issued.joinsWereEnabled ? 'open' as const : 'closed' as const,
        afterStatus: 'open' as const,
        beforeVersion: null,
        afterVersion: null,
      },
    };
  }

  private async disableJoins(input: GameHostCommandInput, transaction: PrismTransactionContext): Promise<PersistedGameHostCommand> {
    const revoked = await this.pins.revokeSessionPin({
      eventId: input.eventId,
      sessionId: input.resourceId,
      actorId: input.actorId,
      now: new Date(),
      reason: 'revoked',
    }, transaction);
    if (revoked === null) throw new ConflictException('Game session was not found for this event');
    return {
      eventId: input.eventId,
      resourceType: 'session' as const,
      resourceId: input.resourceId,
      action: input.action,
      outcome: 'joins_disabled' as const,
      resultId: input.resourceId,
      requestReceiptId: input.requestReceiptId,
      transition: {
        beforeStatus: revoked ? 'open' as const : 'closed' as const,
        afterStatus: 'closed' as const,
        beforeVersion: null,
        afterVersion: null,
      },
    };
  }

  private async transitionSession(input: GameHostCommandInput, transaction: PrismTransactionContext): Promise<PersistedGameHostCommand> {
    const transition = SESSION_TRANSITIONS[input.action];
    if (!transition) {
      throw new ServiceUnavailableException('This event-game command is not available yet');
    }

    const rows = await transaction.prisma.$queryRaw<TransitionRow[]>`
      WITH prior AS MATERIALIZED (
        SELECT s."event_id", s."id", s."status"
        FROM "event_games"."game_sessions" s
        WHERE s."event_id" = ${input.eventId} AND s."id" = ${input.resourceId}
        FOR UPDATE
      ), changed AS (
        UPDATE "event_games"."game_sessions" s
        SET "status" = ${transition.nextStatus},
          "started_at" = CASE WHEN ${transition.nextStatus} = 'live' THEN COALESCE(s."started_at", NOW()) ELSE s."started_at" END,
          "paused_at" = CASE
            WHEN ${transition.nextStatus} = 'paused' THEN NOW()
            WHEN p."status" = 'paused' AND ${transition.nextStatus} IN ('live', 'completed') THEN NULL
            ELSE s."paused_at"
          END,
          "total_paused_ms" = s."total_paused_ms" + CASE
            WHEN p."status" = 'paused' AND ${transition.nextStatus} IN ('live', 'completed') AND s."paused_at" IS NOT NULL
              THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - s."paused_at")) * 1000))::bigint
            ELSE 0
          END,
          "ended_at" = CASE WHEN ${transition.nextStatus} IN ('completed', 'cancelled') THEN NOW() ELSE s."ended_at" END,
          "updated_at" = NOW()
        FROM prior p
        WHERE s."event_id" = p."event_id" AND s."id" = p."id"
          AND s."status" = ANY(${[...transition.allowedStatuses]}::text[])
        RETURNING s."event_id", s."id" AS "session_id", p."status" AS "before_status", s."status" AS "after_status"
      )
      SELECT * FROM changed
    `;
    const result = rows[0];
    if (!result) {
      // Same response for a missing or out-of-event session; no cross-event existence leak.
      throw new ConflictException('Game session is not in a state that accepts this command');
    }

    if (input.action === 'end_session' || input.action === 'cancel_session') {
      const revoked = await this.pins.revokeSessionPin({
        eventId: input.eventId,
        sessionId: result.session_id,
        actorId: input.actorId,
        now: new Date(),
        reason: 'closed',
      }, transaction);
      if (revoked === null) throw new ConflictException('Game session could not release its PIN reservation');
      await this.scheduler?.cancel({ eventId: input.eventId, sessionId: result.session_id }, transaction);
    }

    return {
      eventId: result.event_id,
      resourceType: 'session',
      resourceId: result.session_id,
      action: input.action,
      outcome: transition.outcome,
      resultId: result.session_id,
      requestReceiptId: input.requestReceiptId,
      transition: {
        beforeStatus: result.before_status as PersistedGameHostCommand['transition']['beforeStatus'],
        afterStatus: result.after_status as PersistedGameHostCommand['transition']['afterStatus'],
        beforeVersion: null,
        afterVersion: null,
      },
    };
  }

  private parsePinIssueCommand(command: Readonly<Record<string, unknown>>) {
    const candidates = command.pinCandidates;
    const idempotencyKeyDigest = command.issueIdempotencyKeyDigest;
    const expiresAt = new Date(String(command.expiresAt ?? ''));
    const now = new Date(String(command.now ?? ''));
    if (
      !Array.isArray(candidates) || candidates.length < 1 || candidates.length > 5 ||
      typeof idempotencyKeyDigest !== 'string' || !/^[a-f0-9]{64}$/.test(idempotencyKeyDigest) ||
      !Number.isFinite(expiresAt.getTime()) || !Number.isFinite(now.getTime()) || expiresAt <= now
    ) {
      throw new ServiceUnavailableException('Session PIN issuance command is invalid');
    }
    const parsedCandidates = candidates.map((candidate, index) => {
      if (
        !candidate || typeof candidate !== 'object' ||
        typeof (candidate as { pinDigest?: unknown }).pinDigest !== 'string' ||
        !/^[a-f0-9]{64}$/.test((candidate as { pinDigest: string }).pinDigest) ||
        (candidate as { generationAttempt?: unknown }).generationAttempt !== index
      ) {
        throw new ServiceUnavailableException('Session PIN issuance candidate is invalid');
      }
      return candidate as { pinDigest: string; generationAttempt: number };
    });
    return { candidates: parsedCandidates, idempotencyKeyDigest, expiresAt, now };
  }
}

function parseAdvanceRoundCommand(command: Readonly<Record<string, unknown>>): AdvanceRoundCommand {
  const parsed = advanceRoundCommandSchema.safeParse(command);
  if (!parsed.success) throw new ServiceUnavailableException('Game round advancement command is invalid');
  return parsed.data;
}
