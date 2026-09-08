import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type CommandReceiptKey = {
  commandName: string;
  idempotencyKey: string;
  actorId: string;
};

export type CommandReceiptRecord = CommandReceiptKey & {
  id: string;
  actorRole: string;
  eventId: string | null;
  correlationId: string;
  payloadHash: string | null;
  result: unknown;
  completedAt: Date;
};

export type CommandReceiptCreate = CommandReceiptKey & {
  actorRole: string;
  eventId?: string;
  correlationId: string;
  payloadHash?: string;
};

export interface CommandReceiptStore {
  find(key: CommandReceiptKey, context?: PrismTransactionContext): Promise<CommandReceiptRecord | null>;
  create(input: CommandReceiptCreate, context: PrismTransactionContext): Promise<{ id: string }>;
  complete(id: string, result: unknown, context: PrismTransactionContext): Promise<void>;
}
