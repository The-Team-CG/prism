import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { AccessControlModule } from '@prism/kernel/access-control';
import { EventCoreModule } from '@prism/kernel/event-core';
import { FloorplanModule } from '../floorplan/floorplan.module';
import { IdentityAccessModule } from '../identity-access/identity-access.module';
import { EventSessionModule } from '@prism/kernel/event-session';
import { PlatformOpsModule } from '../platform-ops/platform-ops.module';
import { EventLifecycleModule } from '../event-lifecycle/event-lifecycle.module';
import { OpsCoordinatorWorkspaceController } from './api/staffing/coordinator-workspace.controller';
import { OpsEventCoordinatorAssignmentsController } from './api/staffing/event-coordinator-assignments.controller';
import { OpsCoordinatorsController } from './api/staffing/coordinators.controller';
import { OpsCoordinatorCapacityController } from './api/staffing/coordinator-capacity.controller';
import { OpsGuestController } from './api/guest/guest.controller';
import { OpsRegistrationPlatformController } from './api/guest/registration-platform.controller';
import { WalkInPolicyController } from './api/guest/walk-in-policy.controller';
import { STAFFING_COMMANDS, STAFFING_READER } from './contracts/staffing-ops.tokens';
import { GUEST_COMMANDS, GUEST_READER, REGISTRATION_PLATFORM_READER } from './contracts/guest-ops.tokens';
import { CoordinatorWorkspaceReadService } from './application/staffing/coordinator-workspace-read.service';
import { CoordinatorsService } from './application/staffing/coordinators.service';
import { GuestWorkflowService } from './application/guest/guest-workflow.service';
import { RegistrationPlatformService } from './application/guest/registration-platform.service';
import { WalkInPolicyService } from './application/guest/walk-in-policy.service';

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
  imports: [DatabaseModule, AccessControlModule, EventCoreModule, PlatformOpsModule, FloorplanModule, IdentityAccessModule, EventSessionModule, EventLifecycleModule],
  controllers: [OpsCoordinatorsController, OpsCoordinatorWorkspaceController, OpsEventCoordinatorAssignmentsController, OpsCoordinatorCapacityController, OpsGuestController, OpsRegistrationPlatformController, WalkInPolicyController],
  providers: [
    CoordinatorsService,
    CoordinatorWorkspaceReadService,
    GuestWorkflowService,
    RegistrationPlatformService,
    WalkInPolicyService,
    { provide: STAFFING_COMMANDS, useExisting: CoordinatorsService },
    { provide: STAFFING_READER, useExisting: CoordinatorsService },
    { provide: GUEST_COMMANDS, useExisting: GuestWorkflowService },
    { provide: GUEST_READER, useExisting: GuestWorkflowService },
    { provide: REGISTRATION_PLATFORM_READER, useExisting: RegistrationPlatformService },
  ],
  exports: [CoordinatorsService, CoordinatorWorkspaceReadService, STAFFING_COMMANDS, STAFFING_READER, GuestWorkflowService, RegistrationPlatformService, WalkInPolicyService, GUEST_COMMANDS, GUEST_READER, REGISTRATION_PLATFORM_READER],
})
export class OperationsModule {}
