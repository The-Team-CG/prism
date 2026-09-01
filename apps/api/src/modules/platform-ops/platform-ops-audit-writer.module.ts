import { Global, Module } from '@nestjs/common';
import { AUDIT_WRITER } from '@prism/kernel/access-control';
import { AuditWriterAdapter } from './infrastructure/trust/audit-writer.adapter';
import { PlatformOpsModule } from './platform-ops.module';

/**
 * Composition-root bridge for kernel consumers that need to record an audit
 * event without depending on the platform-ops implementation.
 */
@Global()
@Module({
  imports: [PlatformOpsModule],
  providers: [{ provide: AUDIT_WRITER, useExisting: AuditWriterAdapter }],
  exports: [AUDIT_WRITER],
})
export class PlatformOpsAuditWriterModule {}
