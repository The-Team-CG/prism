import type { Prisma } from '@prisma/client';

export interface PrismCommandContext {
  actorId: string;
  actorRole: string;
  eventId?: string;
  correlationId: string;
  idempotencyKey?: string;
}

export interface PrismTransactionContext {
  prisma: Prisma.TransactionClient;
  correlationId: string;
  actorId?: string;
}

export type PrismSideEffectMode = 'same_tx' | 'after_commit' | 'durable_outbox' | 'read_only';