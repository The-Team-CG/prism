import { ConflictException, Inject, Injectable, Optional } from '@nestjs/common';
import { GAME_ACTION_CLOCK } from '../contracts/game-action-store.port';
import { GAME_AUDIT, type GameAuditPort } from '../contracts/game-audit.port';
import { GAME_EVENT_ACCESS, type GameEventAccessPort } from '../contracts/game-event-access.port';
import { GAME_MODERATION_STORE, type GameModerationStorePort } from '../contracts/game-moderation-store.port';
import type { PrismModerateEventGameInput, PrismVerifiedEventActor } from '@prism/types';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';

@Injectable()
export class GameModerationService {
  constructor(
    @Inject(GAME_EVENT_ACCESS) private readonly eventAccess: GameEventAccessPort,
    @Inject(GAME_MODERATION_STORE) private readonly store: GameModerationStorePort,
    @Inject(GAME_AUDIT) private readonly audit: GameAuditPort,
    private readonly transactions: PrismTransactionRunner,
    @Optional() @Inject(GAME_ACTION_CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  async moderate(
    eventId: string,
    sessionId: string,
    actor: PrismVerifiedEventActor,
    request: PrismModerateEventGameInput,
  ) {
    await this.eventAccess.assertHostAccess(eventId, actor);
    const now = this.clock();

    return this.transactions.run(async (transaction) => {
      if (!(await this.eventAccess.isEventOpen(eventId, transaction))) {
        throw new ConflictException('Event games are closed');
      }
      const result = await this.store.applyModeration({
        eventId, sessionId, actorId: actor.actorId, request, now,
      }, transaction);
      if (!result) throw new ConflictException('Game moderation target is unavailable');

      await this.audit.recordHostWrite({
        eventId,
        actorId: actor.actorId,
        actorRole: actor.actorRole,
        action: 'moderate_participant',
        resourceType: request.action === 'remove_participant' ? 'participation' : 'session',
        resourceId: result.targetId,
        outcome: 'moderated',
        resultId: result.id,
        requestReceiptId: request.idempotencyKey,
        transition: {
          beforeStatus: result.beforeStatus,
          afterStatus: result.afterStatus,
          beforeVersion: null,
          afterVersion: null,
        },
        timestamp: now,
      }, transaction);
      return result;
    }, { actorId: actor.actorId });
  }
}
