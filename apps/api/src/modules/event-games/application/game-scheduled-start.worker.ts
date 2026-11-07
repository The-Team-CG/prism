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
    // QUERY_AUDIT_RAW_SQL: Plain keyed read of one session scheduled start; no lock or write, so Prisma findFirst could serve it.
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
    // QUERY_AUDIT_RAW_SQL: Conditional clear: nulls scheduled_start_at only while the session is completed or cancelled; status guard and write are one statement.
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
    // QUERY_AUDIT_RAW_SQL: Plain read of due scheduled sessions, ordered and capped by MAX_DUE_STARTS; no lock or write.
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
        // QUERY_AUDIT_RAW_SQL: FOR SHARE on the published game definition: a concurrent archive or unpublish waits until this scheduled start commits.
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
        // QUERY_AUDIT_RAW_SQL: Compare-and-set start: moves the session to live only while it is still scheduled and due; RETURNING reports whether this worker won.
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
