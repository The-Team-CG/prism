import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { FinanceOpsModule } from '@prism/modules/finance-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import {
  SUPPLIER_COMMANDS,
  SUPPLIER_DIRECTORY,
  SUPPLIER_DOCUMENT_VAULT,
  SUPPLIER_LIVE_OPERATIONS,
  SUPPLIER_PARE_AUTOMATION,
  SupplierNetworkWorkflowService,
  SupplierOpsModule,
} from '@prism/modules/supplier-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { EVENT_OPS_CONTROLLERS } from './controllers';
import { EventOpsService } from './event-ops.service';
import { AiGovernanceService } from './services/ai-governance.service';
import { AuthOperationsService } from './services/auth-operations.service';
import { ClientOnboardingWorkflowService } from './services/client-onboarding-workflow.service';
import { CommercialWorkflowService } from './services/commercial-workflow.service';
import { ComplianceWorkflowService } from './services/compliance-workflow.service';
import { CoordinatorsService } from './services/coordinators.service';
import { DocumentVaultService } from './services/document-vault.service';
import { EventClosureService } from './services/event-closure.service';
import { EventLifecycleService } from './services/event-lifecycle.service';
import { EventReadModelsService } from './services/event-read-models.service';
import { FileRequirementsMatrixService } from './services/file-requirements-matrix.service';
import { FloorPlanWorkflowService } from './services/floor-plan-workflow.service';
import { GuestWorkflowService } from './services/guest-workflow.service';
import { InquiriesService } from './services/inquiries.service';
import { InquiryWorkflowService } from './services/inquiry-workflow.service';
import { LiveOperationsService } from './services/live-operations.service';
import { PAREService } from './services/pare/pare.service';
import { SampleStateService } from './services/sample-state.service';
import { SuppliersService } from './services/suppliers.service';


const EVENT_OPS_PROVIDERS = [
  DocumentVaultService,
  EventLifecycleService,
  SampleStateService,
  InquiryWorkflowService,
  AiGovernanceService,
  SuppliersService,
  PAREService,
  InquiriesService,
  AuthOperationsService,
  CoordinatorsService,
  LiveOperationsService,
  FileRequirementsMatrixService,
  FloorPlanWorkflowService,
  EventReadModelsService,
  CommercialWorkflowService,
  EventClosureService,
  ComplianceWorkflowService,
  ClientOnboardingWorkflowService,
  GuestWorkflowService,
  { provide: SUPPLIER_DIRECTORY, useExisting: SuppliersService },
  { provide: SUPPLIER_PARE_AUTOMATION, useExisting: PAREService },
  { provide: SUPPLIER_LIVE_OPERATIONS, useExisting: LiveOperationsService },
  { provide: SUPPLIER_DOCUMENT_VAULT, useExisting: DocumentVaultService },
  SupplierNetworkWorkflowService,
  { provide: SUPPLIER_COMMANDS, useExisting: SupplierNetworkWorkflowService },
  EventOpsService,
];

@Module({
  imports: [DatabaseModule, EventCoreModule, TrustOpsModule, NotificationOpsModule, AccessControlModule, SupplierOpsModule, FinanceOpsModule],
  controllers: EVENT_OPS_CONTROLLERS,
  providers: EVENT_OPS_PROVIDERS,
})
export class EventOpsModule {}
