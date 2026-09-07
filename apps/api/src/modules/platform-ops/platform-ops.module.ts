import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { EventSessionModule } from '@prism/kernel/event-session';
import { OpsAuditController, OpsPrivacyController } from './api/trust/audit-privacy.controller';
import { OpsNotificationsController } from './api/notifications/notifications.controller';
import { OpsAiGovernanceController } from './api/ai-governance/ai-governance.controller';
import { AuditWriterAdapter } from './infrastructure/trust/audit-writer.adapter';
import { AUDIT_WRITER } from './contracts/trust/trust-ops.tokens';
import { NotificationOutboxWriterAdapter } from './infrastructure/notifications/notification-outbox-writer.adapter';
import { NOTIFICATION_OUTBOX_WRITER } from './contracts/notifications/notification-ops.tokens';
import { AuditService } from './application/trust/audit.service';
import { PrivacyOperationsService } from './application/trust/privacy-operations.service';
import { NotificationOutboxService } from './application/notifications/notification-outbox.service';
import { AiGovernanceService } from './application/ai-governance/ai-governance.service';
import { PAREService } from './application/ai-governance/pare/pare.service';

const auditWriterProvider = {
  provide: AUDIT_WRITER,
  useExisting: AuditWriterAdapter,
};

const notificationOutboxWriterProvider = {
  provide: NOTIFICATION_OUTBOX_WRITER,
  useExisting: NotificationOutboxWriterAdapter,
};

/**
 * Platform-ops bounded-context composition root. It owns the trust,
 * notification-outbox, and AI-governance capabilities that support the
 * event operating system while remaining independently testable sub-areas.
 * Merged from the former `trust-ops`, `notification-ops`, and
 * `ai-governance` Nest library modules (2026-09-01).
 *
 * Owned tables: OpsAuditLog, OpsLoginHistory, OpsNotificationLog,
 * OpsPrivacyRequest, OpsSecurityAlert, OpsAiApprovalRecord, and OpsAiAuditLog.
 * OpsApprovalRequest is owned by identity-access; privacy erasure may update
 * identity, event, guest, and other records as an explicit platform governance
 * workflow rather than a shared ownership claim.
 */
@Module({
  imports: [DatabaseModule, EventSessionModule],
  controllers: [OpsAuditController, OpsPrivacyController, OpsNotificationsController, OpsAiGovernanceController],
  providers: [
    AuditService,
    PrivacyOperationsService,
    AuditWriterAdapter,
    auditWriterProvider,
    NotificationOutboxService,
    NotificationOutboxWriterAdapter,
    notificationOutboxWriterProvider,
    AiGovernanceService,
    PAREService,
  ],
  exports: [
    AuditService,
    PrivacyOperationsService,
    AuditWriterAdapter,
    auditWriterProvider,
    NotificationOutboxService,
    NotificationOutboxWriterAdapter,
    notificationOutboxWriterProvider,
    AiGovernanceService,
    PAREService,
  ],
})
export class PlatformOpsModule {}
