import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { AccessControlModule } from '@prism/kernel/access-control';
import { EventCoreModule } from '@prism/kernel/event-core';
import { EventSessionModule } from '@prism/kernel/event-session';
import { PlatformOpsModule } from '../platform-ops/platform-ops.module';
import { OperationsModule } from '../operations/operations.module';
import { CLIENT_ONBOARDING_COMMANDS, INQUIRY_COMMANDS } from './contracts/inquiry-onboarding.tokens';
import { OpsEventBriefingController } from './api/onboarding/event-briefing.controller';
import { OpsInquiriesController } from './api/onboarding/inquiries.controller';
import { OpsOnboardingController } from './api/onboarding/onboarding.controller';
import { ClientOnboardingWorkflowService } from './application/onboarding/client-onboarding-workflow.service';
import { InquiriesService } from './application/onboarding/inquiries.service';
import { InquiryConformeReminderScheduler } from './application/onboarding/inquiry-conforme-reminder.scheduler';
import { InquiryWorkflowService } from './application/onboarding/inquiry-workflow.service';
import { OpsComplianceController } from './api/compliance/compliance-rules.controller';
import { OpsEventComplianceController } from './api/compliance/event-compliance.controller';
import { COMPLIANCE_COMMANDS, COMPLIANCE_READER } from './contracts/compliance-ops.tokens';
import { ComplianceWorkflowService } from './application/compliance/compliance-workflow.service';
import { ComplianceReevaluationScheduler } from './application/compliance/compliance-reevaluation.scheduler';
import { CLOSURE_COMMANDS, CLOSURE_READINESS_READER } from './contracts/closure-ops.tokens';
import { EventClosureService } from './application/closure/event-closure.service';
import { EventWrapUpReminderScheduler } from './application/closure/event-wrap-up-reminder.scheduler';
import { OpsEventFileRequirementsController } from './api/files/event-file-requirements.controller';
import { FILE_REQUIREMENT_COMMANDS, FILE_REQUIREMENT_READER } from './contracts/file-ops.tokens';
import { DocumentVaultService } from './application/files/document-vault.service';
import { DOCUMENT_VAULT } from './contracts/document-vault.port';
import { FileRequirementsMatrixService } from './application/files/file-requirements-matrix.service';
import { EventDocumentJourneyController } from './api/files/event-document-journey.controller';
import { EventDecisionController } from './api/decisions/event-decision.controller';
import { EventDecisionService } from './application/decisions/event-decision.service';
import { ChangeManagementController } from './api/change/change-management.controller';
import { ChangeManagementService } from './application/change/change-management.service';
import { ClientEventDayViewController } from './api/client-visibility/client-event-day-view.controller';
import { ClientEventDayViewService } from './application/client-visibility/client-event-day-view.service';
import { OcularVisitController } from './api/ocular-visit/ocular-visit.controller';
import { OcularVisitService } from './application/ocular-visit/ocular-visit.service';
import { IdentityAccessModule } from '../identity-access/identity-access.module';
import { EventClientFloorplanAccessController } from './api/client-visibility/event-client-floorplan-access.controller';
import { LifecyclePrivacyRedactorService } from './application/onboarding/lifecycle-privacy-redactor.service';
import { LIFECYCLE_PRIVACY_REDACTOR } from './contracts/privacy-redaction.port';
import { EventLifecycleReferenceModule } from './event-lifecycle-reference.module';
import { OperationsEventReferenceModule } from './operations-reference.module';
import { CommercialAddendumImpactModule } from '@prism/contexts/commercial';
import { EventLifecycleProjectionModule } from './event-lifecycle-projection.module';
import { FloorplanReferenceModule } from './floorplan-reference.module';
import { ClientFloorplanAccessModule } from './client-floorplan-access.module';

const metadataOnlyFileCommands = { storageProviderMode: 'metadata_only' as const };

/**
 * Bounded-context composition root for event-lifecycle: the event record's
 * own lifecycle from inquiry through closure. Merged from the former
 * `inquiry-onboarding`, `compliance-ops`, `closure-ops`, and `file-ops`
 * Nest library modules (2026-09-01). `inquiry-onboarding` owns `OpsEvent`
 * itself; `compliance-ops` and `closure-ops` write status/derived fields
 * onto it, and Floorplan sends a versioned state projection through the
 * Lifecycle capability. `file-ops` is a read-only requirements-matrix view over
 * documents owned by this and other contexts. Kept as four sub-areas
 * (`onboarding`, `compliance`, `closure`, `files`) under one context.
 *
 * Owned tables: OpsBriefing, OpsDocument (all document metadata), OpsEvent,
 * OpsInquiry, OpsPostEventDocument, OpsEventWrapUp, OpsComplianceCheck,
 * OpsComplianceRule, and OpsEventInsight. Lifecycle owns addendum records and
 * impact history; Commercial applies billing-source and selected-quote changes
 * through its owner capability. Current briefing and conforme workflows do
 * not create initial billing rows because they carry no priced-source input.
 * Read-only: ongoing billing records and OpsSupplierReview via commercial.
 * File requirements is a read-only composition over owned and external
 * document kinds.
 */
@Module({
  imports: [
    DatabaseModule,
    EventCoreModule,
    PlatformOpsModule,
    OperationsModule,
    EventLifecycleReferenceModule,
    OperationsEventReferenceModule,
    CommercialAddendumImpactModule,
    EventLifecycleProjectionModule,
    FloorplanReferenceModule,
    ClientFloorplanAccessModule,
    AccessControlModule,
    EventSessionModule,
    forwardRef(() => IdentityAccessModule),
  ],
  controllers: [
    OpsInquiriesController,
    OpsOnboardingController,
    OpsEventBriefingController,
    OpsComplianceController,
    OpsEventComplianceController,
    OpsEventFileRequirementsController,
    EventDocumentJourneyController,
    EventDecisionController,
    ChangeManagementController,
    ClientEventDayViewController,
    OcularVisitController,
    EventClientFloorplanAccessController,
  ],
  providers: [
    InquiriesService,
    InquiryWorkflowService,
    ClientOnboardingWorkflowService,
    InquiryConformeReminderScheduler,
    { provide: INQUIRY_COMMANDS, useExisting: InquiriesService },
    { provide: CLIENT_ONBOARDING_COMMANDS, useExisting: ClientOnboardingWorkflowService },
    ComplianceWorkflowService,
    ComplianceReevaluationScheduler,
    { provide: COMPLIANCE_COMMANDS, useExisting: ComplianceWorkflowService },
    { provide: COMPLIANCE_READER, useExisting: ComplianceWorkflowService },
    EventClosureService,
    EventWrapUpReminderScheduler,
    { provide: CLOSURE_COMMANDS, useExisting: EventClosureService },
    { provide: CLOSURE_READINESS_READER, useExisting: EventClosureService },
    DocumentVaultService,
    { provide: DOCUMENT_VAULT, useExisting: DocumentVaultService },
    FileRequirementsMatrixService,
    { provide: FILE_REQUIREMENT_READER, useExisting: FileRequirementsMatrixService },
    { provide: FILE_REQUIREMENT_COMMANDS, useValue: metadataOnlyFileCommands },
    EventDecisionService,
    ChangeManagementService,
    ClientEventDayViewService,
    OcularVisitService,
    LifecyclePrivacyRedactorService,
    { provide: LIFECYCLE_PRIVACY_REDACTOR, useExisting: LifecyclePrivacyRedactorService },
  ],
  exports: [
    InquiriesService,
    InquiryWorkflowService,
    ClientOnboardingWorkflowService,
    INQUIRY_COMMANDS,
    CLIENT_ONBOARDING_COMMANDS,
    ComplianceWorkflowService,
    COMPLIANCE_COMMANDS,
    COMPLIANCE_READER,
    EventClosureService,
    CLOSURE_COMMANDS,
    CLOSURE_READINESS_READER,
    DocumentVaultService,
    DOCUMENT_VAULT,
    FileRequirementsMatrixService,
    FILE_REQUIREMENT_READER,
    FILE_REQUIREMENT_COMMANDS,
    ChangeManagementService,
    LIFECYCLE_PRIVACY_REDACTOR,
    EventLifecycleReferenceModule,
    EventLifecycleProjectionModule,
    FloorplanReferenceModule,
    OperationsEventReferenceModule,
    ClientFloorplanAccessModule,
  ],
})
export class EventLifecycleModule {}
