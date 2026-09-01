import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export interface AuditWriteInput {
  eventId?: string;
  actor: string;
  action: string;
  actorRole?: string;
  actorEmail?: string;
  actionType?: string;
  category?: string;
  affectedType?: string;
  affectedId?: string;
  affectedLabel?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  device?: string;
  severity?: string;
  createdAt?: Date;
}

export interface AuditWriter {
  write(input: AuditWriteInput, context?: PrismTransactionContext): Promise<unknown>;
}
