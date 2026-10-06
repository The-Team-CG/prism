import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { AccessControlModule } from '@prism/kernel/access-control';
import { EventCoreModule } from '@prism/kernel/event-core';
import { FloorplanModule } from '../floorplan/floorplan.module';
import { EventSessionModule } from '@prism/kernel/event-session';
import { PlatformOpsModule } from '../platform-ops/platform-ops.module';
import { OperationsEventReferenceModule } from '@prism/contexts/event-lifecycle/operations-reference';
import { CoordinatorAccountReferenceModule } from '@prism/contexts/identity-access/coordinator-reference';
import { RegistrationSupplierReferenceModule } from '@prism/contexts/commercial/registration-supplier-reference';
import { GuestEventProjectionModule } from '@prism/contexts/read-models/guest-events';
import { OpsCoordinatorWorkspaceController } from './api/staffing/coordinator-workspace.controller';
import { OpsEventCoordinatorAssignmentsController } from './api/staffing/event-coordinator-assignments.controller';
import { OpsCoordinatorsController } from './api/staffing/coordinators.controller';
import { OpsCoordinatorCapacityController } from './api/staffing/coordinator-capacity.controller';
import { OpsGuestController } from './api/guest/guest.controller';
import { OpsRegistrationPlatformController } from './api/guest/registration-platform.controller';
import { WalkInPolicyController } from './api/guest/walk-in-policy.controller';
import { GuestPrivacyClassificationController } from './api/guest/guest-privacy-classification.controller';
import { STAFFING_COMMANDS, STAFFING_READER } from './contracts/staffing-ops.tokens';
import { COORDINATOR_RELIABILITY_WRITER } from './contracts/coordinator-reliability-writer.token';
import { COORDINATOR_INSIGHT_FACTS_READER } from './contracts/coordinator-insight-facts-reader.port';
import { GUEST_COMMANDS, GUEST_READER, REGISTRATION_PLATFORM_READER } from './contracts/guest-ops.tokens';
import { CoordinatorWorkspaceReadService } from './application/staffing/coordinator-workspace-read.service';
import { CoordinatorsService } from './application/staffing/coordinators.service';
import { CoordinatorAssignmentCommandService } from './application/staffing/coordinator-assignment-command.service';
import { CoordinatorReliabilityNoteWriterService } from './application/staffing/coordinator-reliability-note-writer.service';
import { CoordinatorInsightFactsReaderService } from './application/staffing/coordinator-insight-facts-reader.service';
import { CoordinatorSuggestionsService } from './application/staffing/coordinator-suggestions.service';
import { CoordinatorAcknowledgementReminderScheduler } from './application/staffing/coordinator-acknowledgement-reminder.scheduler';
import { GuestWorkflowService } from './application/guest/guest-workflow.service';
import { RegistrationPlatformService } from './application/guest/registration-platform.service';
import { WalkInPolicyService } from './application/guest/walk-in-policy.service';
import { GuestPrivacyClassificationService } from './application/guest/guest-privacy-classification.service';
import { OperationsPrivacyRedactorService } from './application/guest/operations-privacy-redactor.service';
import { OPERATIONS_PRIVACY_REDACTOR } from './contracts/privacy-redaction.port';

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
 * Live Ops and event lifecycle use the staffing command port for assignment changes), OpsCoordinatorReliabilityNote,
 * OpsGuestCheckIn, OpsGuestFeedback.
 * Read-only: OpsCoordinator pool profiles are fixture-provisioned, while Operations owns their
 * staffing eligibility; linked account state is resolved through the Identity capability. OpsEvent
 * command checks use Lifecycle, and guest/workspace projections use read-models.
 */
@Module({
  imports: [DatabaseModule, AccessControlModule, EventCoreModule, PlatformOpsModule, FloorplanModule, EventSessionModule, OperationsEventReferenceModule, CoordinatorAccountReferenceModule, RegistrationSupplierReferenceModule, GuestEventProjectionModule],
  controllers: [OpsCoordinatorsController, OpsCoordinatorWorkspaceController, OpsEventCoordinatorAssignmentsController, OpsCoordinatorCapacityController, OpsGuestController, OpsRegistrationPlatformController, WalkInPolicyController, GuestPrivacyClassificationController],
  providers: [
    CoordinatorsService,
    CoordinatorAssignmentCommandService,
    CoordinatorReliabilityNoteWriterService,
    CoordinatorInsightFactsReaderService,
    CoordinatorSuggestionsService,
    CoordinatorAcknowledgementReminderScheduler,
    CoordinatorWorkspaceReadService,
    GuestWorkflowService,
    RegistrationPlatformService,
    WalkInPolicyService,
    GuestPrivacyClassificationService,
    OperationsPrivacyRedactorService,
    { provide: OPERATIONS_PRIVACY_REDACTOR, useExisting: OperationsPrivacyRedactorService },
    { provide: STAFFING_COMMANDS, useExisting: CoordinatorAssignmentCommandService },
    { provide: COORDINATOR_RELIABILITY_WRITER, useExisting: CoordinatorReliabilityNoteWriterService },
    { provide: COORDINATOR_INSIGHT_FACTS_READER, useExisting: CoordinatorInsightFactsReaderService },
    { provide: STAFFING_READER, useExisting: CoordinatorsService },
    { provide: GUEST_COMMANDS, useExisting: GuestWorkflowService },
    { provide: GUEST_READER, useExisting: GuestWorkflowService },
    { provide: REGISTRATION_PLATFORM_READER, useExisting: RegistrationPlatformService },
  ],
  exports: [CoordinatorsService, CoordinatorWorkspaceReadService, STAFFING_COMMANDS, STAFFING_READER, COORDINATOR_RELIABILITY_WRITER, COORDINATOR_INSIGHT_FACTS_READER, GuestWorkflowService, RegistrationPlatformService, WalkInPolicyService, GUEST_COMMANDS, GUEST_READER, REGISTRATION_PLATFORM_READER, OPERATIONS_PRIVACY_REDACTOR],
})
export class OperationsModule {}
