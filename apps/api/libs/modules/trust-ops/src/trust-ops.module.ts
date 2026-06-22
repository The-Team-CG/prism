import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { OpsAuditController, OpsPrivacyController } from './controllers/audit-privacy.controller';
import { AuditWriterAdapter } from './ports/audit-writer.adapter';
import { AUDIT_WRITER } from './ports/trust-ops.tokens';
import { AuditService } from './services/audit.service';
import { PrivacyOperationsService } from './services/privacy-operations.service';

const auditWriterProvider = {
  provide: AUDIT_WRITER,
  useExisting: AuditWriterAdapter,
};

@Module({
  imports: [DatabaseModule],
  controllers: [OpsAuditController, OpsPrivacyController],
  providers: [AuditService, PrivacyOperationsService, AuditWriterAdapter, auditWriterProvider],
  exports: [AuditService, PrivacyOperationsService, AuditWriterAdapter, auditWriterProvider],
})
export class TrustOpsModule {}
