import { Module } from '@nestjs/common';
import { NotificationInboxController, NotificationProviderOutcomeController } from './api/notifications/notification-inbox.controller';
import { NotificationInboxService } from './application/notifications/notification-inbox.service';
import { NotificationProviderOutcomeService } from './application/notifications/notification-provider-outcome.service';
import { NotificationEscalationService } from './application/notifications/notification-escalation.service';
import { EMAIL_OUTCOME_READER } from './contracts/notifications/email-outcome-reader.port';
import { ResendNotificationOutcomeReader } from './infrastructure/notifications/resend-notification-outcome.reader';
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
import { NotificationRecipientDeliveryService } from './application/notifications/notification-recipient-delivery.service';
import { NOTIFICATION_DELIVERY } from './contracts/notifications/notification-delivery.port';
import { MailNotificationDeliveryAdapter } from './infrastructure/notifications/mail-notification-delivery.adapter';
import { ChannelNotificationDeliveryAdapter } from './infrastructure/notifications/channel-notification-delivery.adapter';
import { ViberBotClient } from './infrastructure/notifications/viber-bot.client';
import { resolveViberConfig } from '@prism/kernel/shared';
import { VIBER_BOT } from './contracts/notifications/viber.port';
import { NotificationPreferenceService } from './application/notifications/notification-preference.service';
import { NotificationPreferencesController, ResendWebhookController, ViberWebhookController } from './api/notifications/notification-preferences.controller';
import { ResendWebhookService } from './application/notifications/resend-webhook.service';
import { CanvaController } from './api/integrations/canva.controller';
import { CANVA_API_CLIENT, CanvaConnectionService } from './application/integrations/canva-connection.service';
import { CanvaApiClient } from './infrastructure/integrations/canva-api.client';
import { CANVA_DESIGNS } from './contracts/integrations/canva-designs.port';
import { PortalUrlsModule, resolveCanvaConfig } from '@prism/kernel/shared';
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
import { AnthropicProviderAdapter, createAnthropicProviderClient } from './infrastructure/ai-governance/anthropic-provider.adapter';
import { OpenRouterProviderAdapter } from './infrastructure/ai-governance/openrouter-provider.adapter';
import type { AiProviderAdapter } from './contracts/ai-governance/ai-gateway.port';
import type { AiGatewayRuntimeConfig } from './application/ai-governance/gateway/ai-gateway.config';
import { PAREService } from './application/ai-governance/pare/pare.service';
import { PareDispatchOutboxService } from './application/ai-governance/pare/pare-dispatch-outbox.service';
import { PARE_APPROVAL_GOVERNANCE, PARE_DISPATCH_WRITER } from './contracts/ai-governance/pare-ops.tokens';
import { StorageObjectService } from './application/storage/storage-object.service';
import { STORED_REQUIREMENT_UPLOAD_READER } from './contracts/storage/storage.port';
import { StorageValidationService } from './application/storage/storage-validation.service';
import { GUEST_FEEDBACK_MEDIA_STORE, STORAGE_ADAPTER, STORED_SUPPLIER_UPLOAD_READER } from './contracts/storage/storage.port';
import { LocalFileSystemStorageAdapter } from './infrastructure/storage/local-filesystem-storage.adapter';
import { SupabaseStorageAdapter } from './infrastructure/storage/supabase-storage.adapter';
import { StorageController } from './api/storage/storage.controller';
import { ConformeCommsDraftsController } from './api/ai-governance/conforme-comms-drafts.controller';
import { ConformeCommsDraftService } from './application/ai-governance/conforme-comms-draft.service';
import { InquiryTriageService } from './application/ai-governance/inquiry-triage.service';
import { ProposalDraftService } from './application/ai-governance/proposal-draft.service';
import { ClientMessageDraftsController, InquiryTriageController, ProposalDraftsController } from './api/ai-governance/ai-drafting.controllers';
import { ClientMessageDraftService } from './application/ai-governance/client-message-draft.service';
import { AiAdvisoryController } from './api/ai-governance/ai-advisory.controller';
import { AiAdvisoryService } from './application/ai-governance/ai-advisory.service';

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
  runtime: AiGatewayRuntimeConfig,
  config: Pick<ConfigService, 'get'>,
): AiProviderAdapter[] {
  const adapters: AiProviderAdapter[] = [];
  const liveProviders = new Set([...runtime.liveUseCases].map((useCaseId) =>
    resolveAiRoute(runtime.profile, useCaseId, AI_USE_CASE_REGISTRY[useCaseId].modelTier).provider));
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
  imports: [DatabaseModule, EventSessionModule, ConfigModule, AccessControlModule, ConformeReminderWindowModule, AccountContactReadModelModule, MailModule, PortalUrlsModule],
  controllers: [ResendWebhookController, NotificationProviderOutcomeController, NotificationInboxController, OpsAuditController, OpsNotificationsController, OpsAiGovernanceController, StorageController, ConformeCommsDraftsController, InquiryTriageController, ProposalDraftsController, ClientMessageDraftsController, AiAdvisoryController, NotificationPreferencesController, ViberWebhookController, CanvaController],
  providers: [
    NotificationInboxService,
    NotificationProviderOutcomeService,
    ResendWebhookService,
    NotificationEscalationService,
    { provide: EMAIL_OUTCOME_READER, useClass: ResendNotificationOutcomeReader },
    AuditService,
    AuditReadService,
    AuditExportService,
    SecurityOperationsService,
    AuditWriterAdapter,
    auditWriterProvider,
    NotificationOutboxService,
    NotificationRecipientDeliveryService,
    NotificationOutboxWriterAdapter,
    notificationOutboxWriterProvider,
    MailNotificationDeliveryAdapter,
    {
      provide: VIBER_BOT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const viber = resolveViberConfig((name) => config.get<string>(name));
        return viber ? new ViberBotClient(viber) : null;
      },
    },
    NotificationPreferenceService,
    { provide: NOTIFICATION_DELIVERY, useClass: ChannelNotificationDeliveryAdapter },
    {
      provide: CANVA_API_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const canva = resolveCanvaConfig((name) => config.get<string>(name));
        return canva ? new CanvaApiClient(canva) : null;
      },
    },
    CanvaConnectionService,
    { provide: CANVA_DESIGNS, useExisting: CanvaConnectionService },
    AiGovernanceService,
    ConformeCommsDraftService,
    InquiryTriageService,
    ProposalDraftService,
    ClientMessageDraftService,
    AiAdvisoryService,
    {
      provide: AI_GATEWAY_RUNTIME_CONFIG,
      inject: [ConfigService],
      useFactory: resolveAiGatewayRuntimeConfig,
    },
    {
      provide: AI_PROVIDER_ADAPTERS,
      inject: [AI_GATEWAY_RUNTIME_CONFIG, ConfigService],
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
    { provide: STORED_REQUIREMENT_UPLOAD_READER, useExisting: StorageObjectService },
    { provide: GUEST_FEEDBACK_MEDIA_STORE, useExisting: StorageObjectService },
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
    STORED_REQUIREMENT_UPLOAD_READER,
    GUEST_FEEDBACK_MEDIA_STORE,
    STORAGE_ADAPTER,
    CANVA_DESIGNS,
  ],
})
export class PlatformOpsModule {}
