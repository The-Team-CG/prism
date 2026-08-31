import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { IdentityOpsModule } from '@prism/modules/identity-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { StaffingOpsModule } from '@prism/modules/staffing-ops';
import { SupplierOpsModule } from '@prism/modules/supplier-ops';
import { EventReadModelsModule } from '@prism/modules/event-read-models';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { CoordinatorLiveOpsController } from './controllers/coordinator-live-ops.controller';
import { EventLiveOpsController } from './controllers/event-live-ops.controller';
import { SupplierLiveOpsController } from './controllers/supplier-live-ops.controller';
import { EventLiveOpsCommandService } from './services/event-live-ops-command.service';
import { EventLiveOpsReadService } from './services/event-live-ops-read.service';
import { LiveOperationsService } from './services/live-operations.service';

/**
 * Owned tables: OpsCoordinatorAssignment (live-ops-triggered updates; day-to-day staffing assignment owned by staffing-ops), OpsCoordinatorReliabilityNote, OpsEventDayLog, OpsEventDayTask, OpsUrgentIssue.
 * Read-only: OpsCoordinator (sample-seeded only; no owning module), OpsEvent (via inquiry-onboarding).
 */
@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    EventCoreModule,
    TrustOpsModule,
    NotificationOpsModule,
    StaffingOpsModule,
    SupplierOpsModule,
    EventReadModelsModule,
    IdentityOpsModule,
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
