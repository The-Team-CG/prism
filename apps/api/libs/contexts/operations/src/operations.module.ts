import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { FloorplanModule } from '@prism/contexts/floorplan';
import { IdentityOpsModule } from '@prism/modules/identity-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { EventLifecycleModule } from '@prism/contexts/event-lifecycle';
import { OpsCoordinatorWorkspaceController } from './api/staffing/coordinator-workspace.controller';
import { OpsEventCoordinatorAssignmentsController } from './api/staffing/event-coordinator-assignments.controller';
import { OpsCoordinatorsController } from './api/staffing/coordinators.controller';
import { OpsGuestController } from './api/guest/guest.controller';
import { STAFFING_COMMANDS, STAFFING_READER } from './contracts/staffing-ops.tokens';
import { GUEST_COMMANDS, GUEST_READER } from './contracts/guest-ops.tokens';
import { CoordinatorWorkspaceReadService } from './application/staffing/coordinator-workspace-read.service';
import { CoordinatorsService } from './application/staffing/coordinators.service';
import { GuestWorkflowService } from './application/guest/guest-workflow.service';

/**
 * Bounded-context composition root for operations: day-to-day coordinator
 * staffing (`api/staffing`, `application/staffing`) and guest check-in/feedback
 * (`api/guest`, `application/guest`). Merged from the former `staffing-ops`
 * and `guest-ops` Nest library modules (2026-09-01) — both are ground-level
 * event support operations with no dependency back on `event-read-models`, so
 * they merge safely (unlike `live-ops`, which structurally sits above
 * `event-read-models` and was kept as its own context — see the design doc's
 * correction note).
 *
 * Owned tables: OpsCoordinatorAssignment (day-to-day staffing assignment;
 * live-ops also writes here for event-day updates), OpsGuestCheckIn,
 * OpsGuestFeedback.
 * Read-only: OpsCoordinator (sample-seeded only; no owning module), OpsEvent
 * (via inquiry-onboarding).
 */
@Module({
  imports: [DatabaseModule, AccessControlModule, EventCoreModule, TrustOpsModule, NotificationOpsModule, FloorplanModule, IdentityOpsModule, EventLifecycleModule],
  controllers: [OpsCoordinatorsController, OpsCoordinatorWorkspaceController, OpsEventCoordinatorAssignmentsController, OpsGuestController],
  providers: [
    CoordinatorsService,
    CoordinatorWorkspaceReadService,
    GuestWorkflowService,
    { provide: STAFFING_COMMANDS, useExisting: CoordinatorsService },
    { provide: STAFFING_READER, useExisting: CoordinatorsService },
    { provide: GUEST_COMMANDS, useExisting: GuestWorkflowService },
    { provide: GUEST_READER, useExisting: GuestWorkflowService },
  ],
  exports: [CoordinatorsService, CoordinatorWorkspaceReadService, STAFFING_COMMANDS, STAFFING_READER, GuestWorkflowService, GUEST_COMMANDS, GUEST_READER],
})
export class OperationsModule {}
