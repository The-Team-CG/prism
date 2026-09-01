import { Injectable } from '@nestjs/common';
import type { PrismTransactionContext } from '../../../../../core/shared-kernel/src';
import { AuditService } from '../../application/trust/audit.service';
import type { AuditWriteInput, AuditWriter } from '../../contracts/trust/audit-writer.port';

@Injectable()
export class AuditWriterAdapter implements AuditWriter {
  constructor(private readonly auditService: AuditService) {}

  write(input: AuditWriteInput, context?: PrismTransactionContext) {
    const { eventId, actor, action, ...options } = input;
    return this.auditService.audit(eventId, actor, action, options, context);
  }
}
