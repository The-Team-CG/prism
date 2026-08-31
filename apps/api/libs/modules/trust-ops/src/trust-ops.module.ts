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

/**
 * Owned tables: OpsApprovalRequest (non-2FA approval kinds; identity-ops owns 2FA/account approval requests), OpsAuditLog, OpsGuestCheckIn (via GDPR erasure workflow only; guest-ops owns the record), OpsGuestFeedback (via GDPR erasure workflow only; guest-ops owns the record), OpsInquiry (via GDPR erasure workflow only; inquiry-onboarding owns the record), OpsLoginHistory, OpsNotificationLog (trust-ops writes its own audit-triggered notifications; notification-ops owns the general queue), OpsPrivacyRequest, OpsSecurityAlert, OpsSupplier (via GDPR erasure workflow only; supplier-ops owns the record), OpsUser (lockout-tracking fields only; identity-ops owns the record).
 * Read-only: OpsEvent (via inquiry-onboarding).
 */
@Module({
  imports: [DatabaseModule],
  controllers: [OpsAuditController, OpsPrivacyController],
  providers: [AuditService, PrivacyOperationsService, AuditWriterAdapter, auditWriterProvider],
  exports: [AuditService, PrivacyOperationsService, AuditWriterAdapter, auditWriterProvider],
})
export class TrustOpsModule {}
