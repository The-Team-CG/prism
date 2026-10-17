import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { PrismaService } from '@prism/kernel/database';
import { GAME_AUDIT, type GameAuditPort } from '../contracts/game-audit.port';
import { GAME_PIN_STORE, type GamePinStorePort } from '../contracts/game-pin-store.port';
import { GAME_EVENT_ACCESS, type GameEventAccessPort } from '../contracts/game-event-access.port';
import type { GameSchedulerPort } from '../contracts/game-scheduler.port';

const POLL_INTERVAL_MS = 5_000;
const MAX_DUE_STARTS = 50;
const SYSTEM_ACTOR_ID = 'system:event-games-scheduler';
const PIN_EXPIRY_ACTOR_ID = 'system:expiry';

interface DueStartRow {
  event_id: string;
  session_id: string;
  game_definition_id: string;
  request_receipt_id: string;
}

@Injectable()
export class GameScheduledStartWorker
  implements GameSchedulerPort, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(GameScheduledStartWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private inFlight?: Promise<void>;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly transactions: PrismTransactionRunner,
    @Inject(GAME_AUDIT) private readonly audit: GameAuditPort,
    @Inject(GAME_PIN_STORE) private readonly pinStore: GamePinStorePort,
    @Inject(GAME_EVENT_ACCESS) private readonly eventAccess: GameEventAccessPort,
  ) {}

  async schedule(
    input: { eventId: string; sessionId: string; startsAt: Date },
    transaction: PrismTransactionContext,
  ): Promise<void> {
    const rows = await transaction.prisma.$queryRaw<Array<{ session_id: string }>>`
      SELECT id AS session_id
      FROM "event_games"."game_sessions"
      WHERE event_id = ${input.eventId}
        AND id = ${input.sessionId}
        AND status = 'scheduled'
        AND scheduled_start_at = ${input.startsAt}
    `;
    if (!rows[0]) {
      throw new ConflictException('Scheduled game session was not persisted');
    }
  }

  async cancel(
    input: { eventId: string; sessionId: string },
    transaction: PrismTransactionContext,
  ): Promise<void> {
    await transaction.prisma.$executeRaw`
      UPDATE "event_games"."game_sessions"
      SET scheduled_start_at = NULL, updated_at = NOW()
      WHERE event_id = ${input.eventId}
        AND id = ${input.sessionId}
        AND status IN ('completed', 'cancelled')
    `;
  }

  onApplicationBootstrap(): void {
    // Only the wake-up interval is process-local; due state lives in PostgreSQL.
    this.timer = setInterval(() => { void this.runScheduled(); }, POLL_INTERVAL_MS);
    void this.runScheduled();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }

  async runDueStarts(now = new Date()): Promise<number> {
    await this.transactions.run(
      (transaction) => this.pinStore.releaseExpiredReservations({ now }, transaction),
      { actorId: PIN_EXPIRY_ACTOR_ID },
    );
    const due = await this.prisma.$queryRaw<DueStartRow[]>`
      SELECT event_id, id AS session_id, game_definition_id,
        COALESCE(start_idempotency_key, id) AS request_receipt_id
      FROM "event_games"."game_sessions"
      WHERE status = 'scheduled' AND scheduled_start_at <= ${now}
      ORDER BY scheduled_start_at ASC, id ASC
      LIMIT ${MAX_DUE_STARTS}
    `;

    let started = 0;
    for (const candidate of due) {
      const claimed = await this.transactions.run(async (transaction) => {
        if (!(await this.eventAccess.isEventOpen(candidate.event_id, transaction))) return false;
        const activeDefinition = await transaction.prisma.$queryRaw<Array<{ id: string }>>`
          SELECT d."id"
          FROM "event_games"."game_definitions" d
          WHERE d."event_id" = ${candidate.event_id}
            AND d."id" = ${candidate.game_definition_id}
            AND d."status" = 'published'
            AND d."archived_at" IS NULL
          FOR SHARE OF d
        `;
        if (!activeDefinition[0]) return false;
        const transition = await transaction.prisma.$queryRaw<Array<{
          event_id: string;
          session_id: string;
        }>>`
          UPDATE "event_games"."game_sessions"
          SET status = 'live',
            started_at = COALESCE(started_at, ${now}),
            updated_at = ${now}
          WHERE event_id = ${candidate.event_id}
            AND id = ${candidate.session_id}
            AND status = 'scheduled'
            AND scheduled_start_at <= ${now}
          RETURNING event_id, id AS session_id
        `;
        const row = transition[0];
        if (!row) return false;

        await this.audit.recordHostWrite({
          eventId: row.event_id,
          actorId: SYSTEM_ACTOR_ID,
          actorRole: 'system',
          action: 'start_session',
          resourceType: 'session',
          resourceId: row.session_id,
          outcome: 'started',
          resultId: row.session_id,
          requestReceiptId: candidate.request_receipt_id,
          transition: {
            beforeStatus: 'scheduled',
            afterStatus: 'live',
            beforeVersion: null,
            afterVersion: null,
          },
          timestamp: now,
        }, transaction);
        return true;
      }, { actorId: SYSTEM_ACTOR_ID });

      if (claimed) started += 1;
    }
    return started;
  }

  private runScheduled(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.runDueStarts()
      .then(() => undefined)
      .catch((error: unknown) => {
        this.logger.error(
          'Scheduled game start poll failed',
          error instanceof Error ? error.stack : String(error),
        );
      })
      .finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  }
}
