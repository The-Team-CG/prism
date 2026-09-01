import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { AccessControlModule } from '@prism/kernel/access-control';
import { EventCoreModule } from '@prism/kernel/event-core';
import { EventSessionModule } from '@prism/kernel/event-session';
import { PlatformOpsModule } from '@prism/contexts/platform-ops';
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
import { OpsEventClosureController } from './api/closure/event-closure.controller';
import { CLOSURE_COMMANDS, CLOSURE_READINESS_READER } from './contracts/closure-ops.tokens';
import { EventClosureService } from './application/closure/event-closure.service';
import { OpsEventFileRequirementsController } from './api/files/event-file-requirements.controller';
import { FILE_REQUIREMENT_COMMANDS, FILE_REQUIREMENT_READER, SIGNED_UPLOAD_URL_FACTORY } from './contracts/file-ops.tokens';
import { MetadataOnlySignedUploadUrlFactory } from './contracts/signed-upload-url-factory.port';
import { DocumentVaultService } from './application/files/document-vault.service';
import { FileRequirementsMatrixService } from './application/files/file-requirements-matrix.service';

const metadataOnlyFileCommands = { storageProviderMode: 'metadata_only' as const };

/**
 * Bounded-context composition root for event-lifecycle: the event record's
 * own lifecycle from inquiry through closure. Merged from the former
 * `inquiry-onboarding`, `compliance-ops`, `closure-ops`, and `file-ops`
 * Nest library modules (2026-09-01). `inquiry-onboarding` owns `OpsEvent`
 * itself; `compliance-ops` and `closure-ops` write status/derived fields
 * onto it, `file-ops` is a read-only requirements-matrix view over
 * documents owned by this and other contexts. Kept as four sub-areas
 * (`onboarding`, `compliance`, `closure`, `files`) under one context.
 *
 * Owned tables: OpsBillingSource (initial creation only; ongoing billing
 * owned by commercial), OpsBillingStatement (initial creation only; ongoing
 * billing owned by commercial), OpsBriefing, OpsDocument (inquiry/onboarding
 * document kinds), OpsEvent, OpsInquiry, OpsPaymentMilestone (initial
 * creation only; ongoing billing owned by commercial), OpsPostEventDocument,
 * OpsComplianceCheck, OpsComplianceRule, OpsEventInsight.
 * Read-only: OpsBillingStatement (via commercial), OpsDocument (via
 * commercial), OpsPaymentMilestone (via commercial), OpsPostEventDocument,
 * OpsSupplierReview (via commercial).
 */
@Module({
  imports: [
    DatabaseModule,
    EventCoreModule,
    PlatformOpsModule,
    AccessControlModule,
    EventSessionModule,
  ],
  controllers: [
    OpsInquiriesController,
    OpsOnboardingController,
    OpsEventBriefingController,
    OpsComplianceController,
    OpsEventComplianceController,
    OpsEventClosureController,
    OpsEventFileRequirementsController,
  ],
  providers: [
    InquiriesService,
    InquiryWorkflowService,
    ClientOnboardingWorkflowService,
    InquiryConformeReminderScheduler,
    { provide: INQUIRY_COMMANDS, useExisting: InquiriesService },
    { provide: CLIENT_ONBOARDING_COMMANDS, useExisting: ClientOnboardingWorkflowService },
    ComplianceWorkflowService,
    { provide: COMPLIANCE_COMMANDS, useExisting: ComplianceWorkflowService },
    { provide: COMPLIANCE_READER, useExisting: ComplianceWorkflowService },
    EventClosureService,
    { provide: CLOSURE_COMMANDS, useExisting: EventClosureService },
    { provide: CLOSURE_READINESS_READER, useExisting: EventClosureService },
    DocumentVaultService,
    FileRequirementsMatrixService,
    MetadataOnlySignedUploadUrlFactory,
    { provide: FILE_REQUIREMENT_READER, useExisting: FileRequirementsMatrixService },
    { provide: FILE_REQUIREMENT_COMMANDS, useValue: metadataOnlyFileCommands },
    { provide: SIGNED_UPLOAD_URL_FACTORY, useExisting: MetadataOnlySignedUploadUrlFactory },
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
    FileRequirementsMatrixService,
    FILE_REQUIREMENT_READER,
    FILE_REQUIREMENT_COMMANDS,
    SIGNED_UPLOAD_URL_FACTORY,
  ],
})
export class EventLifecycleModule {}
