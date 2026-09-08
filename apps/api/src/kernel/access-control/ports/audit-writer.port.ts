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
  /** Durable fallback when the primary audit chain is unavailable. */
  recordIntegrityIncident?(input: {
    source: string;
    reason: string;
    eventId?: string;
    actor?: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
}

export type AuditWriteOptions = Omit<AuditWriteInput, 'eventId' | 'actor' | 'action'>;

/** Preserve the readable application-level audit call shape at the port. */
export function writeAudit(
  writer: AuditWriter,
  eventId: string | undefined,
  actor: string,
  action: string,
  options: AuditWriteOptions = {},
  context?: PrismTransactionContext,
) {
  return writer.write({ eventId, actor, action, ...options }, context);
}
