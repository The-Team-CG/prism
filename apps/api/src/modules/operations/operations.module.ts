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
import { CoordinatorReplacementRecommendationService } from './application/staffing/coordinator-replacement-recommendation.service';
import { CoordinatorReplacementRecommendationsController } from './api/staffing/coordinator-replacement-recommendations.controller';
import { CoordinatorReliabilityNoteWriterService } from './application/staffing/coordinator-reliability-note-writer.service';
import { CoordinatorInsightFactsReaderService } from './application/staffing/coordinator-insight-facts-reader.service';
import { CoordinatorSuggestionsService } from './application/staffing/coordinator-suggestions.service';
import { CoordinatorAcknowledgementReminderScheduler } from './application/staffing/coordinator-acknowledgement-reminder.scheduler';
import { GuestWorkflowService } from './application/guest/guest-workflow.service';
import { GuestQrPassService } from './application/guest/guest-qr-pass.service';
import { GuestQrPassController } from './api/guest/guest-qr-pass.controller';
import { RegistrationPlatformService } from './application/guest/registration-platform.service';
import { WalkInPolicyService } from './application/guest/walk-in-policy.service';
import { CoordinatorRoleBriefService } from './application/staffing/coordinator-role-brief.service';
import { CoordinatorRoleBriefController } from './api/staffing/coordinator-role-brief.controller';
import { GuestPrivacyClassificationService } from './application/guest/guest-privacy-classification.service';
import { OperationsPrivacyRedactorService } from './application/guest/operations-privacy-redactor.service';
import { OPERATIONS_PRIVACY_REDACTOR } from './contracts/privacy-redaction.port';

@Module({
  imports: [DatabaseModule, AccessControlModule, EventCoreModule, PlatformOpsModule, FloorplanModule, EventSessionModule, OperationsEventReferenceModule, CoordinatorAccountReferenceModule, RegistrationSupplierReferenceModule, GuestEventProjectionModule],
  controllers: [OpsCoordinatorsController, OpsCoordinatorWorkspaceController, OpsEventCoordinatorAssignmentsController, OpsCoordinatorCapacityController, OpsGuestController, OpsRegistrationPlatformController, WalkInPolicyController, GuestPrivacyClassificationController, CoordinatorRoleBriefController, CoordinatorReplacementRecommendationsController, GuestQrPassController],
  providers: [
    CoordinatorsService,
    CoordinatorAssignmentCommandService,
    CoordinatorReplacementRecommendationService,
    CoordinatorReliabilityNoteWriterService,
    CoordinatorInsightFactsReaderService,
    CoordinatorSuggestionsService,
    CoordinatorAcknowledgementReminderScheduler,
    CoordinatorWorkspaceReadService,
    GuestWorkflowService,
    GuestQrPassService,
    RegistrationPlatformService,
    WalkInPolicyService,
    CoordinatorRoleBriefService,
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
