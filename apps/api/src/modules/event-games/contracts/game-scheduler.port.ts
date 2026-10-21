import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const GAME_SCHEDULER = Symbol('GAME_SCHEDULER');

export interface GameSchedulerPort {
  schedule(input: {
    eventId: string;
    sessionId: string;
    startsAt: Date;
  }, transaction: PrismTransactionContext): Promise<void>;
  cancel(input: { eventId: string; sessionId: string }, transaction: PrismTransactionContext): Promise<void>;
}
