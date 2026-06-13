import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { EVENT_OPS_CONTROLLERS } from './controllers';
import { EventOpsService } from './event-ops.service';
import { SampleStateService } from './services/sample-state.service';
import { InquiryWorkflowService } from './services/inquiry-workflow.service';
import { EventAccessPolicyService } from './services/event-access-policy.service';
import { EventLifecycleService } from './services/event-lifecycle.service';
import { FileRequirementsMatrixService } from './services/file-requirements-matrix.service';
import { NotificationOutboxService } from './services/notification-outbox.service';
import { WorkflowCommandService } from './services/workflow-command.service';
import { AuditService } from './services/audit.service';
import { EventReadModelsService } from './services/event-read-models.service';
import { SuppliersService } from './services/suppliers.service';
import { SupplierNetworkWorkflowService } from './services/supplier-network-workflow.service';
import { CommercialWorkflowService } from './services/commercial-workflow.service';
import { EventClosureService } from './services/event-closure.service';
import { PAREService } from './services/pare/pare.service';
import { LiveOperationsService } from './services/live-operations.service';

@Module({
  imports: [DatabaseModule],
  controllers: EVENT_OPS_CONTROLLERS,
  providers: [
    EventOpsService,
    AuditService,
    SuppliersService,
    SampleStateService,
    InquiryWorkflowService,
    EventAccessPolicyService,
    EventLifecycleService,
    FileRequirementsMatrixService,
    NotificationOutboxService,
    WorkflowCommandService,
    EventReadModelsService,
    CommercialWorkflowService,
    SupplierNetworkWorkflowService,
    LiveOperationsService,
    EventClosureService,
    PAREService,
  ],
})
export class EventOpsModule {}
