import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AiGovernanceModule, PAREService } from '@prism/modules/ai-governance';
import { AccessControlModule } from '@prism/modules/access-control';
import { ClosureOpsModule } from '@prism/modules/closure-ops';
import { CommercialOpsModule, CommercialWorkflowService } from '@prism/modules/commercial-ops';
import { ComplianceOpsModule, ComplianceWorkflowService } from '@prism/modules/compliance-ops';
import { EventCoreModule } from '@prism/modules/event-core';
import { EventReadModelsModule } from '@prism/modules/event-read-models';
import { FloorplanModule } from '@prism/modules/floorplan';
import { GuestOpsModule } from '@prism/modules/guest-ops';
import { IdentityOpsModule } from '@prism/modules/identity-ops';
import { StaffingOpsModule } from '@prism/modules/staffing-ops';
import { FileOpsModule, DocumentVaultService } from '@prism/modules/file-ops';
import { InquiryOnboardingModule } from '@prism/modules/inquiry-onboarding';
import { FinanceOpsModule } from '@prism/modules/finance-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { LiveOpsModule } from '@prism/modules/live-ops';
import {
  SUPPLIER_COMMANDS,
  SUPPLIER_DOCUMENT_VAULT,
  SUPPLIER_LIVE_OPERATIONS,
  SUPPLIER_PARE_AUTOMATION,
  SupplierNetworkWorkflowService,
  SupplierOpsModule,
} from '@prism/modules/supplier-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { EVENT_OPS_CONTROLLERS } from './controllers';
import { EventOpsService } from './event-ops.service';
import { LiveOperationsService } from './services/live-operations.service';
import { SampleStateService } from './services/sample-state.service';

const EVENT_OPS_PROVIDERS = [
  SampleStateService,
  LiveOperationsService,
  ComplianceWorkflowService,
  { provide: SUPPLIER_PARE_AUTOMATION, useFactory: (pareService: PAREService) => pareService, inject: [PAREService] },
  { provide: SUPPLIER_LIVE_OPERATIONS, useExisting: LiveOperationsService },
  { provide: SUPPLIER_DOCUMENT_VAULT, useExisting: DocumentVaultService },
  SupplierNetworkWorkflowService,
  { provide: SUPPLIER_COMMANDS, useExisting: SupplierNetworkWorkflowService },
  EventOpsService,
];

@Module({
  imports: [DatabaseModule, EventCoreModule, TrustOpsModule, NotificationOpsModule, AccessControlModule, SupplierOpsModule, FinanceOpsModule, FileOpsModule, InquiryOnboardingModule, CommercialOpsModule, ComplianceOpsModule, FloorplanModule, GuestOpsModule, StaffingOpsModule, EventReadModelsModule, ClosureOpsModule, IdentityOpsModule, AiGovernanceModule, LiveOpsModule],
  controllers: EVENT_OPS_CONTROLLERS,
  providers: EVENT_OPS_PROVIDERS,
})
export class EventOpsModule {}
