import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@prism/kernel/database';
import { EventSessionModule } from '@prism/kernel/event-session';
import { AccessControlModule } from '@prism/kernel/access-control';
import { ConformeReminderWindowModule } from '@prism/contexts/event-lifecycle/conforme-reminder-window';
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
import { AiGatewayService } from './application/ai-governance/gateway/ai-gateway.service';
import {
  AI_GATEWAY_RUNTIME_CONFIG,
  AI_PROVIDER_ADAPTERS,
  AI_SYNTHETIC_PROVENANCE_VERIFIER,
  resolveAiGatewayRuntimeConfig,
} from './application/ai-governance/gateway/ai-gateway.config';
import { SyntheticFixtureRegistry } from './application/ai-governance/gateway/synthetic-fixture-registry';
import { AI_GATEWAY } from './contracts/ai-governance/ai-gateway.port';
import { MockAiProviderAdapter } from './infrastructure/ai-governance/mock-ai-provider.adapter';
import { AnthropicProviderAdapter, createAnthropicProviderClient } from './infrastructure/ai-governance/anthropic-provider.adapter';
import type { AiProviderAdapter } from './contracts/ai-governance/ai-gateway.port';
import type { AiGatewayRuntimeConfig } from './application/ai-governance/gateway/ai-gateway.config';
import { PAREService } from './application/ai-governance/pare/pare.service';
import { PareDispatchOutboxService } from './application/ai-governance/pare/pare-dispatch-outbox.service';
import { PARE_APPROVAL_GOVERNANCE, PARE_DISPATCH_WRITER } from './contracts/ai-governance/pare-ops.tokens';
import { StorageObjectService } from './application/storage/storage-object.service';
import { StorageValidationService } from './application/storage/storage-validation.service';
import { STORAGE_ADAPTER } from './contracts/storage/storage.port';
import { LocalFileSystemStorageAdapter } from './infrastructure/storage/local-filesystem-storage.adapter';
import { StorageController } from './api/storage/storage.controller';
import { ConformeCommsDraftsController } from './api/ai-governance/conforme-comms-drafts.controller';
import { ConformeCommsDraftService } from './application/ai-governance/conforme-comms-draft.service';

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

export function createAiProviderAdapters(
  mockAdapter: MockAiProviderAdapter,
  runtime: AiGatewayRuntimeConfig,
  config: Pick<ConfigService, 'get'>,
): AiProviderAdapter[] {
  const adapters: AiProviderAdapter[] = [mockAdapter];
  if (runtime.profileId !== 'test-anthropic' || runtime.liveUseCases.size === 0) {
    return adapters;
  }

  const apiKey = config.get<string>('ANTHROPIC_API_KEY')?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required when AI live use cases are enabled');
  }
  adapters.push(new AnthropicProviderAdapter(createAnthropicProviderClient({ apiKey })));
  return adapters;
}

/**
 * Platform-ops bounded-context composition root. It owns the trust,
 * notification-outbox, and AI-governance capabilities that support the
 * event operating system while remaining independently testable sub-areas.
 * Merged from the former `trust-ops`, `notification-ops`, and
 * `ai-governance` Nest library modules (2026-09-01).
 *
 * Owned tables: OpsAuditLog, OpsLoginHistory, OpsNotificationLog,
 * OpsPareDispatch, OpsPrivacyRequest, OpsSecurityAlert, OpsAiApprovalRecord,
 * and OpsAiAuditLog.
 * OpsApprovalRequest is owned by identity-access; privacy erasure may update
 * identity, event, guest, and other records as an explicit platform governance
 * workflow rather than a shared ownership claim.
 */
@Module({
  imports: [DatabaseModule, EventSessionModule, ConfigModule, AccessControlModule, ConformeReminderWindowModule],
  controllers: [OpsAuditController, OpsPrivacyController, OpsNotificationsController, OpsAiGovernanceController, StorageController, ConformeCommsDraftsController],
  providers: [
    AuditService,
    PrivacyOperationsService,
    AuditWriterAdapter,
    auditWriterProvider,
    NotificationOutboxService,
    NotificationOutboxWriterAdapter,
    notificationOutboxWriterProvider,
    AiGovernanceService,
    ConformeCommsDraftService,
    MockAiProviderAdapter,
    {
      provide: AI_GATEWAY_RUNTIME_CONFIG,
      inject: [ConfigService],
      useFactory: resolveAiGatewayRuntimeConfig,
    },
    {
      provide: AI_PROVIDER_ADAPTERS,
      inject: [MockAiProviderAdapter, AI_GATEWAY_RUNTIME_CONFIG, ConfigService],
      useFactory: createAiProviderAdapters,
    },
    { provide: AI_SYNTHETIC_PROVENANCE_VERIFIER, useClass: SyntheticFixtureRegistry },
    AiGatewayService,
    { provide: AI_GATEWAY, useExisting: AiGatewayService },
    PAREService,
    PareDispatchOutboxService,
    { provide: PARE_APPROVAL_GOVERNANCE, useExisting: PAREService },
    { provide: PARE_DISPATCH_WRITER, useExisting: PareDispatchOutboxService },
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
    ConformeCommsDraftService,
    AiGatewayService,
    AI_GATEWAY,
    PAREService,
    PareDispatchOutboxService,
    PARE_APPROVAL_GOVERNANCE,
    PARE_DISPATCH_WRITER,
    StorageValidationService,
    StorageObjectService,
    STORAGE_ADAPTER,
  ],
})
export class PlatformOpsModule {}
