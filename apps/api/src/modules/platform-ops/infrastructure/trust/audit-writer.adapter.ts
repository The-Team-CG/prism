import { Injectable } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { AuditService } from '../../application/trust/audit.service';
import { SecurityOperationsService } from '../../application/trust/security-operations.service';
import type { AuditWriteInput, AuditWriter } from '../../contracts/trust/audit-writer.port';

@Injectable()
export class AuditWriterAdapter implements AuditWriter {
  constructor(
    private readonly auditService: AuditService,
    private readonly securityOperationsService: SecurityOperationsService,
  ) {}

  write(input: AuditWriteInput, context?: PrismTransactionContext) {
    const { eventId, actor, action, ...options } = input;
    return this.auditService.audit(eventId, actor, action, options, context);
  }

  recordIntegrityIncident(input: Parameters<SecurityOperationsService['recordIntegrityIncident']>[0]) {
    return this.securityOperationsService.recordIntegrityIncident(input);
  }
}
