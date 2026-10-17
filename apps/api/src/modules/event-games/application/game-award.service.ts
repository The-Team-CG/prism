import { ConflictException, Inject, Injectable, Optional } from '@nestjs/common';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import type { PrismAssignEventGameAwardInput, PrismVerifiedEventActor } from '@prism/types';
import { GAME_ACTION_CLOCK } from '../contracts/game-action-store.port';
import { GAME_AUDIT, type GameAuditPort } from '../contracts/game-audit.port';
import { GAME_AWARD_STORE, type GameAwardStorePort } from '../contracts/game-award-store.port';
import { GAME_EVENT_ACCESS, type GameEventAccessPort } from '../contracts/game-event-access.port';

@Injectable()
export class GameAwardService {
  constructor(
    @Inject(GAME_EVENT_ACCESS) private readonly eventAccess: GameEventAccessPort,
    @Inject(GAME_AWARD_STORE) private readonly store: GameAwardStorePort,
    @Inject(GAME_AUDIT) private readonly audit: GameAuditPort,
    private readonly transactions: PrismTransactionRunner,
    @Optional() @Inject(GAME_ACTION_CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  async assign(
    eventId: string,
    sessionId: string,
    actor: PrismVerifiedEventActor,
    request: PrismAssignEventGameAwardInput,
  ) {
    await this.eventAccess.assertHostAccess(eventId, actor);
    const now = this.clock();

    return this.transactions.run(async (transaction) => {
      if (!(await this.eventAccess.isEventOpen(eventId, transaction))) {
        throw new ConflictException('Event games are closed');
      }
      const award = await this.store.assignAward({ eventId, sessionId, actorId: actor.actorId, request, now }, transaction);
      if (!award) throw new ConflictException('Game award target or idempotency key is unavailable');

      await this.audit.recordHostWrite({
        eventId,
        actorId: actor.actorId,
        actorRole: actor.actorRole,
        action: 'assign_reward',
        resourceType: 'reward',
        resourceId: award.id,
        outcome: 'assigned',
        resultId: award.id,
        requestReceiptId: request.idempotencyKey,
        transition: {
          beforeStatus: null,
          afterStatus: 'assigned',
          beforeVersion: null,
          afterVersion: null,
        },
        timestamp: now,
      }, transaction);
      return award;
    }, { actorId: actor.actorId });
  }
}
