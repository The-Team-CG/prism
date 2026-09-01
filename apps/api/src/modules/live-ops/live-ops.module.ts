import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { AccessControlModule } from '@prism/kernel/access-control';
import { EventCoreModule } from '@prism/kernel/event-core';
import { IdentityAccessModule } from '@prism/contexts/identity-access';
import { EventSessionModule } from '@prism/kernel/event-session';
import { PlatformOpsModule } from '@prism/contexts/platform-ops';
import { OperationsModule } from '@prism/contexts/operations';
import { CommercialModule } from '@prism/contexts/commercial';
import { ReadModelsModule } from '@prism/contexts/read-models';
import { CoordinatorLiveOpsController } from './api/coordinator-live-ops.controller';
import { EventLiveOpsController } from './api/event-live-ops.controller';
import { SupplierLiveOpsController } from './api/supplier-live-ops.controller';
import { EventLiveOpsCommandService } from './application/event-live-ops-command.service';
import { EventLiveOpsReadService } from './application/event-live-ops-read.service';
import { LiveOperationsService } from './application/live-operations.service';

/**
 * Owned tables: OpsCoordinatorAssignment (live-ops-triggered updates; day-to-day staffing assignment owned by staffing-ops), OpsCoordinatorReliabilityNote, OpsEventDayLog, OpsEventDayTask, OpsUrgentIssue.
 * Read-only: OpsCoordinator (sample-seeded only; no owning module), OpsEvent (via inquiry-onboarding).
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
    LiveOperationsService,
    EventLiveOpsReadService,
    EventLiveOpsCommandService,
  ],
  exports: [LiveOperationsService, EventLiveOpsReadService, EventLiveOpsCommandService],
})
export class LiveOpsModule {}
