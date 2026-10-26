import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@prism/kernel/database';
import { EventSessionModule } from '@prism/kernel/event-session';
import { AccessControlModule } from '@prism/kernel/access-control';
import { ConformeReminderWindowModule } from '@prism/contexts/event-lifecycle/conforme-reminder-window';
import { AccountContactReadModelModule } from '../read-models/account-contact-read-model.module';
import { OpsAuditController } from './api/trust/audit-privacy.controller';
import { OpsNotificationsController } from './api/notifications/notifications.controller';
import { OpsAiGovernanceController } from './api/ai-governance/ai-governance.controller';
import { AuditWriterAdapter } from './infrastructure/trust/audit-writer.adapter';
import { AUDIT_WRITER } from './contracts/trust/trust-ops.tokens';
import { NotificationOutboxWriterAdapter } from './infrastructure/notifications/notification-outbox-writer.adapter';
import { NOTIFICATION_OUTBOX_WRITER } from './contracts/notifications/notification-ops.tokens';
import { AuditService } from './application/trust/audit.service';
import { AuditExportService } from './application/trust/audit-export.service';
import { AuditReadService } from './application/trust/audit-read.service';
import { SecurityOperationsService } from './application/trust/security-operations.service';
import { NotificationOutboxService } from './application/notifications/notification-outbox.service';
import { NOTIFICATION_DELIVERY } from './contracts/notifications/notification-delivery.port';
import { MailNotificationDeliveryAdapter } from './infrastructure/notifications/mail-notification-delivery.adapter';
import { MailModule } from '@prism/kernel/mail';
import { AiGovernanceService } from './application/ai-governance/ai-governance.service';
import { AiGatewayService } from './application/ai-governance/gateway/ai-gateway.service';
import {
  AI_GATEWAY_RUNTIME_CONFIG,
  AI_PROVIDER_ADAPTERS,
  AI_SYNTHETIC_PROVENANCE_VERIFIER,
  resolveAiGatewayRuntimeConfig,
  resolveAiRoute,
} from './application/ai-governance/gateway/ai-gateway.config';
import { AI_USE_CASE_REGISTRY } from './application/ai-governance/gateway/ai-use-cases';
import { SyntheticFixtureRegistry } from './application/ai-governance/gateway/synthetic-fixture-registry';
import { AI_GATEWAY } from './contracts/ai-governance/ai-gateway.port';
import { MockAiProviderAdapter } from './infrastructure/ai-governance/mock-ai-provider.adapter';
import { AnthropicProviderAdapter, createAnthropicProviderClient } from './infrastructure/ai-governance/anthropic-provider.adapter';
import { OpenRouterProviderAdapter } from './infrastructure/ai-governance/openrouter-provider.adapter';
import type { AiProviderAdapter } from './contracts/ai-governance/ai-gateway.port';
import type { AiGatewayRuntimeConfig } from './application/ai-governance/gateway/ai-gateway.config';
import { PAREService } from './application/ai-governance/pare/pare.service';
import { PareDispatchOutboxService } from './application/ai-governance/pare/pare-dispatch-outbox.service';
import { PARE_APPROVAL_GOVERNANCE, PARE_DISPATCH_WRITER } from './contracts/ai-governance/pare-ops.tokens';
import { StorageObjectService } from './application/storage/storage-object.service';
import { StorageValidationService } from './application/storage/storage-validation.service';
import { STORAGE_ADAPTER, STORED_SUPPLIER_UPLOAD_READER } from './contracts/storage/storage.port';
import { LocalFileSystemStorageAdapter } from './infrastructure/storage/local-filesystem-storage.adapter';
import { SupabaseStorageAdapter } from './infrastructure/storage/supabase-storage.adapter';
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
    if (provider === 'local') {
      const directory = config.get<string>('PRISM_STORAGE_LOCAL_DIRECTORY')?.trim();
      if (!directory) throw new Error('PRISM_STORAGE_LOCAL_DIRECTORY is required when PRISM_STORAGE_PROVIDER=local');
      return new LocalFileSystemStorageAdapter(directory);
    }
    if (provider === 'supabase') {
      const url = config.get<string>('PRISM_STORAGE_SUPABASE_URL')?.trim();
      const key = config.get<string>('PRISM_STORAGE_SUPABASE_SERVICE_ROLE_KEY')?.trim();
      const bucket = config.get<string>('PRISM_STORAGE_SUPABASE_BUCKET')?.trim();
      if (!url || !key || !bucket) throw new Error('PRISM_STORAGE_SUPABASE_URL, PRISM_STORAGE_SUPABASE_SERVICE_ROLE_KEY, and PRISM_STORAGE_SUPABASE_BUCKET are required when PRISM_STORAGE_PROVIDER=supabase');
      return new SupabaseStorageAdapter(url, key, bucket);
    }
    throw new Error(`Unsupported storage provider: ${provider}`);
  },
};

export function createAiProviderAdapters(
  mockAdapter: MockAiProviderAdapter,
  runtime: AiGatewayRuntimeConfig,
  config: Pick<ConfigService, 'get'>,
): AiProviderAdapter[] {
  const adapters: AiProviderAdapter[] = [mockAdapter];
  const liveProviders = new Set([...runtime.liveUseCases].map((useCaseId) =>
    resolveAiRoute(runtime.profile, useCaseId, AI_USE_CASE_REGISTRY[useCaseId].modelTier).provider));
  const unsupportedProviders = [...liveProviders].filter((provider) =>
    provider !== 'mock' && provider !== 'anthropic' && provider !== 'openrouter');
  if (unsupportedProviders.length > 0) {
    throw new Error(`No AI provider adapter factory is registered for: ${unsupportedProviders.join(', ')}`);
  }
  if (liveProviders.has('anthropic')) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY')?.trim();
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required when AI live use cases are enabled');
    }
    adapters.push(new AnthropicProviderAdapter(createAnthropicProviderClient({ apiKey })));
  }

  if (liveProviders.has('openrouter')) {
    const endpointPolicyIds = new Set([...runtime.liveUseCases]
      .map((useCaseId) => resolveAiRoute(runtime.profile, useCaseId, AI_USE_CASE_REGISTRY[useCaseId].modelTier))
      .filter((route) => route.provider === 'openrouter')
      .map((route) => route.endpointPolicyId));
    const [endpointPolicyId] = endpointPolicyIds;
    if (endpointPolicyIds.size !== 1 || !endpointPolicyId) {
      throw new Error('Enabled OpenRouter use cases must share one reviewed endpoint policy');
    }

    const apiKey = config.get<string>('OPENROUTER_API_KEY')?.trim();
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is required when OpenRouter use cases are enabled');
    }
    adapters.push(new OpenRouterProviderAdapter({ apiKey, endpointPolicyId }));
  }

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
 * OpsCommandReceipt, and OpsAiAuditLog.
 * OpsApprovalRequest is owned by identity-access. Privacy orchestration is
 * composed separately with the owner contexts and invokes their redaction
 * capabilities rather than writing their tables from Platform.
 */
@Module({
  imports: [DatabaseModule, EventSessionModule, ConfigModule, AccessControlModule, ConformeReminderWindowModule, AccountContactReadModelModule, MailModule],
  controllers: [OpsAuditController, OpsNotificationsController, OpsAiGovernanceController, StorageController, ConformeCommsDraftsController],
  providers: [
    AuditService,
    AuditReadService,
    AuditExportService,
    SecurityOperationsService,
    AuditWriterAdapter,
    auditWriterProvider,
    NotificationOutboxService,
    NotificationOutboxWriterAdapter,
    notificationOutboxWriterProvider,
    { provide: NOTIFICATION_DELIVERY, useClass: MailNotificationDeliveryAdapter },
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
    { provide: STORED_SUPPLIER_UPLOAD_READER, useExisting: StorageObjectService },
    storageAdapterProvider,
  ],
  exports: [
    AuditService,
    SecurityOperationsService,
    AuditWriterAdapter,
    auditWriterProvider,
    NotificationOutboxService,
    NotificationOutboxWriterAdapter,
    notificationOutboxWriterProvider,
    AiGovernanceService,
    ConformeCommsDraftService,
    AiGatewayService,
    AI_GATEWAY_RUNTIME_CONFIG,
    AI_GATEWAY,
    PAREService,
    PareDispatchOutboxService,
    PARE_APPROVAL_GOVERNANCE,
    PARE_DISPATCH_WRITER,
    StorageValidationService,
    StorageObjectService,
    STORED_SUPPLIER_UPLOAD_READER,
    STORAGE_ADAPTER,
  ],
})
export class PlatformOpsModule {}
