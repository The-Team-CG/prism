import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { IdentityOpsModule } from '@prism/modules/identity-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { OperationsModule } from '@prism/contexts/operations';
import { CommercialModule } from '@prism/contexts/commercial';
import { EventReadModelsModule } from '@prism/modules/event-read-models';
import { TrustOpsModule } from '@prism/modules/trust-ops';
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
    TrustOpsModule,
    NotificationOpsModule,
    OperationsModule,
    CommercialModule,
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
