import type { PrismAssignEventGameAwardInput, PrismEventGameAward } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const GAME_AWARD_STORE = Symbol('GAME_AWARD_STORE');

export interface GameAwardStorePort {
  assignAward(input: {
    eventId: string;
    sessionId: string;
    actorId: string;
    request: PrismAssignEventGameAwardInput;
    now: Date;
  }, transaction: PrismTransactionContext): Promise<PrismEventGameAward | null>;
}
