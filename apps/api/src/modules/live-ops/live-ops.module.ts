import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { AccessControlModule } from '@prism/kernel/access-control';
import { EventCoreModule } from '@prism/kernel/event-core';
import { IdentityAccessModule } from '../identity-access/identity-access.module';
import { EventSessionModule } from '@prism/kernel/event-session';
import { PlatformOpsModule } from '../platform-ops/platform-ops.module';
import { OperationsModule } from '../operations/operations.module';
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
 * Read-only: OpsCoordinator (populated only by local fixtures; no owning module), OpsEvent (via inquiry-onboarding).
 */
@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    EventCoreModule,
    PlatformOpsModule,
    OperationsModule,
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
