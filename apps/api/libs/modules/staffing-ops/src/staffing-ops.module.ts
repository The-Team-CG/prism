import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { FloorplanModule } from '@prism/contexts/floorplan';
import { GuestOpsModule } from '@prism/modules/guest-ops';
import { IdentityOpsModule } from '@prism/modules/identity-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsCoordinatorWorkspaceController } from './controllers/coordinator-workspace.controller';
import { OpsEventCoordinatorAssignmentsController } from './controllers/event-coordinator-assignments.controller';
import { OpsCoordinatorsController } from './controllers/coordinators.controller';
import { STAFFING_COMMANDS, STAFFING_READER } from './ports/staffing-ops.tokens';
import { CoordinatorWorkspaceReadService } from './services/coordinator-workspace-read.service';
import { CoordinatorsService } from './services/coordinators.service';

/**
 * Owned tables: OpsCoordinatorAssignment (day-to-day staffing assignment; live-ops also writes here for event-day updates).
 * Read-only: OpsCoordinator (sample-seeded only; no owning module), OpsEvent (via inquiry-onboarding).
 */
@Module({
  imports: [DatabaseModule, AccessControlModule, EventCoreModule, TrustOpsModule, NotificationOpsModule, FloorplanModule, GuestOpsModule, IdentityOpsModule],
  controllers: [OpsCoordinatorsController, OpsCoordinatorWorkspaceController, OpsEventCoordinatorAssignmentsController],
  providers: [
    CoordinatorsService,
    CoordinatorWorkspaceReadService,
    { provide: STAFFING_COMMANDS, useExisting: CoordinatorsService },
    { provide: STAFFING_READER, useExisting: CoordinatorsService },
  ],
  exports: [CoordinatorsService, CoordinatorWorkspaceReadService, STAFFING_COMMANDS, STAFFING_READER],
})
export class StaffingOpsModule {}
