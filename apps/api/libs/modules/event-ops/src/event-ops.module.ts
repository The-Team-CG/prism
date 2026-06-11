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

@Module({
  imports: [DatabaseModule],
  controllers: EVENT_OPS_CONTROLLERS,
  providers: [
    EventOpsService,
    AuditService,
    SampleStateService,
    InquiryWorkflowService,
    EventAccessPolicyService,
    EventLifecycleService,
    FileRequirementsMatrixService,
    NotificationOutboxService,
    WorkflowCommandService,
  ],
})
export class EventOpsModule {}
