import type { PrismModerateEventGameInput } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const GAME_MODERATION_STORE = Symbol('GAME_MODERATION_STORE');

export interface PersistedGameModeration {
  id: string;
  targetId: string;
  beforeStatus: 'pending' | 'visible' | 'hidden' | 'active' | 'revoked';
  afterStatus: 'visible' | 'hidden' | 'revoked';
}

export interface GameModerationStorePort {
  applyModeration(input: {
    eventId: string;
    sessionId: string;
    actorId: string;
    request: PrismModerateEventGameInput;
    now: Date;
  }, transaction: PrismTransactionContext): Promise<PersistedGameModeration | null>;
}
