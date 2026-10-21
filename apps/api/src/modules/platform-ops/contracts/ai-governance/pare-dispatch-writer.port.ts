import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type PareDispatchWriteInput = {
  eventId: string;
  requestId: string;
  sourceUpdatedAt: Date;
  correlationId: string;
};

export type PareDispatchWriter = {
  queue(input: PareDispatchWriteInput, context?: PrismTransactionContext): Promise<unknown>;
};
