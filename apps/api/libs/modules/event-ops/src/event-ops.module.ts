import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { EVENT_OPS_CONTROLLERS } from './controllers';
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

const EVENT_OPS_PROVIDERS = [
  AuditService,
  NotificationOutboxService,
  WorkflowCommandService,
  DocumentVaultService,
  EventLifecycleService,
  SampleStateService,
  InquiryWorkflowService,
  AiGovernanceService,
  SuppliersService,
  PAREService,
  EventAccessPolicyService,
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
