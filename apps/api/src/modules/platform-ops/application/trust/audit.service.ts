import { Injectable } from '@nestjs/common';
import type { OpsAuditLog } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { appendAuditLog, verifyAuditIntegrity } from './audit-chain';
import { AuditIntegrityConflictException } from './audit-chain.types';
import type { AuditIntegrityConflictKind, AuditLogInput } from './audit-chain.types';

export { AuditIntegrityConflictException };
export type { AuditIntegrityConflictKind, AuditLogInput };

/** Owns append-only audit records and full-chain integrity verification. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async verifyIntegrity() {
    return verifyAuditIntegrity(this.prisma);
  }

  async audit(
    eventId: string | undefined,
    actor: string,
    action: string,
    options: Omit<AuditLogInput, 'eventId' | 'actor' | 'action'> = {},
    context?: PrismTransactionContext,
  ): Promise<OpsAuditLog> {
    return appendAuditLog(this.prisma, { eventId, actor, action, options, context });
  }

}
