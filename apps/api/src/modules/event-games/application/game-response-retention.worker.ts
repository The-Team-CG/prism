import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { GAME_ACTION_STORE, type GameActionStorePort } from '../contracts/game-action-store.port';
import { GAME_EVENT_ACCESS, type GameEventAccessPort } from '../contracts/game-event-access.port';

const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SYSTEM_ACTOR_ID = 'system:event-games-response-retention';

@Injectable()
export class GameResponseRetentionWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(GameResponseRetentionWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private inFlight?: Promise<void>;

  constructor(
    private readonly transactions: PrismTransactionRunner,
    @Inject(GAME_ACTION_STORE) private readonly actionStore: GameActionStorePort,
    @Inject(GAME_EVENT_ACCESS) private readonly eventAccess: GameEventAccessPort,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => { void this.runScheduled(); }, SWEEP_INTERVAL_MS);
    void this.runScheduled();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }

  async redactExpiredResponses(now = new Date()): Promise<number> {
    const eventIds = await this.transactions.run(
      (transaction) => this.actionStore.listResponseRetentionEventIds(now, transaction),
      { actorId: SYSTEM_ACTOR_ID },
    );
    let redacted = 0;
    for (const eventId of eventIds) {
      redacted += await this.transactions.run(async (transaction) => {
        const scope = await this.eventAccess.getResponseRetentionScope(eventId, transaction);
        if (!scope) return 0;
        return this.actionStore.redactExpiredResponses({ eventId, archivedAt: scope.archivedAt, now }, transaction);
      }, { actorId: SYSTEM_ACTOR_ID });
    }
    return redacted;
  }

  private runScheduled(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.redactExpiredResponses()
      .then((count) => {
        if (count > 0) this.logger.log(`Redacted ${count} expired event-game responses`);
      })
      .catch((error: unknown) => {
        this.logger.error(
          'Event-game response retention sweep failed',
          error instanceof Error ? error.stack : String(error),
        );
      })
      .finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  }
}
