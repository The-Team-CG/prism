import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@prism/kernel/database';
import { EventSessionModule } from '@prism/kernel/event-session';
import { AccessControlModule } from '@prism/kernel/access-control';
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
import { StorageObjectService } from './application/storage/storage-object.service';
import { StorageValidationService } from './application/storage/storage-validation.service';
import { STORAGE_ADAPTER } from './contracts/storage/storage.port';
import { LocalFileSystemStorageAdapter } from './infrastructure/storage/local-filesystem-storage.adapter';
import { StorageController } from './api/storage/storage.controller';

const auditWriterProvider = {
  provide: AUDIT_WRITER,
  useExisting: AuditWriterAdapter,
};

const notificationOutboxWriterProvider = {
  provide: NOTIFICATION_OUTBOX_WRITER,
  useExisting: NotificationOutboxWriterAdapter,
};

const storageAdapterProvider = {
  provide: STORAGE_ADAPTER,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const provider = config.get<string>('PRISM_STORAGE_PROVIDER')?.trim().toLowerCase();
    if (!provider) return undefined;
    if (provider !== 'local') throw new Error(`Unsupported storage provider: ${provider}`);
    const directory = config.get<string>('PRISM_STORAGE_LOCAL_DIRECTORY')?.trim();
    if (!directory) throw new Error('PRISM_STORAGE_LOCAL_DIRECTORY is required when PRISM_STORAGE_PROVIDER=local');
    return new LocalFileSystemStorageAdapter(directory);
  },
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
  imports: [DatabaseModule, EventSessionModule, ConfigModule, AccessControlModule],
  controllers: [OpsAuditController, OpsPrivacyController, OpsNotificationsController, OpsAiGovernanceController, StorageController],
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
    StorageValidationService,
    StorageObjectService,
    storageAdapterProvider,
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
    StorageValidationService,
    StorageObjectService,
    STORAGE_ADAPTER,
  ],
})
export class PlatformOpsModule {}
