import { ConflictException } from '@nestjs/common';
import type { AuditChainBreakReason } from './audit-chain-order';

export type AuditLogInput = {
  eventId?: string;
  actor: string;
  actorRole?: string;
  actorEmail?: string;
  action: string;
  actionType?: string;
  category?: string;
  affectedType?: string;
  affectedId?: string;
  affectedLabel?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  device?: string;
  severity?: string;
  previousHash?: string | null;
  createdAt?: Date;
};

export type AuditIntegrityConflictKind = 'ambiguous_tail' | 'broken_chain';

export class AuditIntegrityConflictException extends ConflictException {
  constructor(
    message: string,
    readonly kind: AuditIntegrityConflictKind,
    readonly breakReason: AuditChainBreakReason | null = null,
  ) {
    super(message);
  }
}
