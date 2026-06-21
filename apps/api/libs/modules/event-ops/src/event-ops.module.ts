import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { EVENT_OPS_CONTROLLERS } from './controllers';
import { PrismTransactionRunner } from '../../../core/shared-kernel/src';
import { EventOpsService } from './event-ops.service';
import { AiGovernanceService } from './services/ai-governance.service';
import { AuditService } from './services/audit.service';
import { AuthOperationsService } from './services/auth-operations.service';
import { BillingOperationsService } from './services/billing-operations.service';
import { ClientOnboardingWorkflowService } from './services/client-onboarding-workflow.service';
import { CommercialWorkflowService } from './services/commercial-workflow.service';
import { ComplianceWorkflowService } from './services/compliance-workflow.service';
import { CoordinatorsService } from './services/coordinators.service';
import { DocumentVaultService } from './services/document-vault.service';
import { EventAccessPolicyService } from './services/event-access-policy.service';
import { EventClosureService } from './services/event-closure.service';
import { EventLifecycleService } from './services/event-lifecycle.service';
import { EventReadModelsService } from './services/event-read-models.service';
import { FileRequirementsMatrixService } from './services/file-requirements-matrix.service';
import { FloorPlanWorkflowService } from './services/floor-plan-workflow.service';
import { GuestWorkflowService } from './services/guest-workflow.service';
import { InquiriesService } from './services/inquiries.service';
import { InquiryWorkflowService } from './services/inquiry-workflow.service';
import { LiveOperationsService } from './services/live-operations.service';
import { NotificationOutboxService } from './services/notification-outbox.service';
import { PAREService } from './services/pare/pare.service';
import { PrivacyOperationsService } from './services/privacy-operations.service';
import { SampleStateService } from './services/sample-state.service';
import { SupplierNetworkWorkflowService } from './services/supplier-network-workflow.service';
import { SuppliersService } from './services/suppliers.service';
import { WorkflowCommandService } from './services/workflow-command.service';
import { AuditWriterAdapter } from './ports/audit-writer.adapter';
import { NotificationOutboxWriterAdapter } from './ports/notification-outbox-writer.adapter';
import { EVENT_ACCESS_POLICY } from './ports/access-control.tokens';
import { WORKFLOW_COMMAND_LOG } from './ports/event-core.tokens';
import { NOTIFICATION_OUTBOX_WRITER } from './ports/notification-ops.tokens';
import { AUDIT_WRITER } from './ports/trust-ops.tokens';


const auditWriterProvider = {
  provide: AUDIT_WRITER,
  useExisting: AuditWriterAdapter,
};

const notificationOutboxWriterProvider = {
  provide: NOTIFICATION_OUTBOX_WRITER,
  useExisting: NotificationOutboxWriterAdapter,
};

const eventAccessPolicyProvider = {
  provide: EVENT_ACCESS_POLICY,
  useExisting: EventAccessPolicyService,
};

const workflowCommandLogProvider = {
  provide: WORKFLOW_COMMAND_LOG,
  useExisting: WorkflowCommandService,
};
const EVENT_OPS_PROVIDERS = [
  AuditService,
  NotificationOutboxService,
  PrismTransactionRunner,
  WorkflowCommandService,
  DocumentVaultService,
  EventLifecycleService,
  SampleStateService,
  InquiryWorkflowService,
  AiGovernanceService,
  SuppliersService,
  PAREService,
  EventAccessPolicyService,
  AuditWriterAdapter,
  NotificationOutboxWriterAdapter,
  auditWriterProvider,
  notificationOutboxWriterProvider,
  eventAccessPolicyProvider,
  workflowCommandLogProvider,
  InquiriesService,
  AuthOperationsService,
  PrivacyOperationsService,
  CoordinatorsService,
  LiveOperationsService,
  FileRequirementsMatrixService,
  FloorPlanWorkflowService,
  BillingOperationsService,
  EventReadModelsService,
  CommercialWorkflowService,
  EventClosureService,
  ComplianceWorkflowService,
  ClientOnboardingWorkflowService,
  GuestWorkflowService,
  SupplierNetworkWorkflowService,
  EventOpsService,
];

@Module({
  imports: [DatabaseModule],
  controllers: EVENT_OPS_CONTROLLERS,
  providers: EVENT_OPS_PROVIDERS,
})
export class EventOpsModule {}
