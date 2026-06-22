import { Injectable } from '@nestjs/common';
import type { PrismTransactionContext } from '../../../../core/shared-kernel/src';
import { AuditService } from '../services/audit.service';
import type { AuditWriteInput, AuditWriter } from './audit-writer.port';

@Injectable()
export class AuditWriterAdapter implements AuditWriter {
  constructor(private readonly auditService: AuditService) {}

  write(input: AuditWriteInput, context?: PrismTransactionContext) {
    const { eventId, actor, action, ...options } = input;
    return this.auditService.audit(eventId, actor, action, options, context);
  }
}