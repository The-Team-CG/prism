import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { GameHostAction, GameHostMutationOutcome, GamePersistedTransition, GameResourceType } from './game-persistence.port';

export const GAME_AUDIT = Symbol('GAME_AUDIT');

export interface GameHostWriteAuditInput {
  eventId: string;
  actorId: string;
  actorRole: string;
  action: GameHostAction;
  resourceType: GameResourceType;
  resourceId: string;
  outcome: GameHostMutationOutcome;
  resultId: string;
  requestReceiptId: string;
  transition: GamePersistedTransition;
  timestamp: Date;
}

export interface GameAuditPort {
  recordHostWrite(input: GameHostWriteAuditInput, transaction: PrismTransactionContext): Promise<void>;
}
