import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { AccessControlModule } from '@prism/kernel/access-control';
import { EventCoreModule } from '@prism/kernel/event-core';
import { IdentityAccessModule } from '../identity-access/identity-access.module';
import { EventSessionModule } from '@prism/kernel/event-session';
import { PlatformOpsModule } from '../platform-ops/platform-ops.module';
import { OperationsModule } from '../operations/operations.module';
import { OperationsEventReferenceModule } from '@prism/contexts/event-lifecycle/operations-reference';
import { LiveOpsReferenceModule } from '@prism/contexts/operations/live-ops-reference';
import { CommercialModule } from '../commercial/commercial.module';
import { ReadModelsModule } from '../read-models/read-models.module';
import { CoordinatorLiveOpsController } from './api/coordinator-live-ops.controller';
import { EventLiveOpsController } from './api/event-live-ops.controller';
import { SupplierLiveOpsController } from './api/supplier-live-ops.controller';
import { EventLiveOpsCommandService } from './application/event-live-ops-command.service';
import { EventLiveOpsReadService } from './application/event-live-ops-read.service';
import { CoordinatorLiveOpsCommandService } from './application/coordinator-live-ops-command.service';
import { LiveOpsTaskIssueCommandService } from './application/live-ops-task-issue-command.service';
import { EventScheduleService } from './application/event-schedule.service';

/**
 * Owned tables: OpsEventDayLog, OpsEventDayTask, OpsUrgentIssue. Assignment and coordinator reliability changes use the Operations staffing port.
 * Read-only: Lifecycle supplies event state; Operations supplies coordinator and assignment references. LiveOps stores scalar event, operator, and handoff assignment IDs; history keeps its recorded display snapshots.
 */
@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    EventCoreModule,
    PlatformOpsModule,
    OperationsModule,
    OperationsEventReferenceModule,
    LiveOpsReferenceModule,
    CommercialModule,
    ReadModelsModule,
    IdentityAccessModule,
    EventSessionModule,
  ],
  controllers: [EventLiveOpsController, CoordinatorLiveOpsController, SupplierLiveOpsController],
  providers: [
    CoordinatorLiveOpsCommandService,
    LiveOpsTaskIssueCommandService,
    EventLiveOpsReadService,
    EventLiveOpsCommandService,
    EventScheduleService,
  ],
  exports: [EventLiveOpsReadService, EventLiveOpsCommandService, EventScheduleService],
})
export class LiveOpsModule {}
