import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import {
  DemoController,
  OpsAiController,
  OpsAuditController,
  OpsAuthController,
  OpsBillingController,
  OpsClientController,
  OpsCoordinatorWorkspaceController,
  OpsComplianceController,
  OpsCoordinatorsController,
  OpsEventsController,
  OpsGuestController,
  OpsInquiriesController,
  OpsNotificationsController,
  OpsOnboardingController,
  OpsPrivacyController,
  OpsQuoteRequestsController,
  OpsSupplierWorkspaceController,
  OpsSuppliersController,
} from './event-ops.controller';
import { EventOpsService } from './event-ops.service';
import { DemoStateService } from './services/demo-state.service';
import { InquiryWorkflowService } from './services/inquiry-workflow.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    DemoController,
    OpsAiController,
    OpsAuditController,
    OpsAuthController,
    OpsInquiriesController,
    OpsNotificationsController,
    OpsPrivacyController,
    OpsEventsController,
    OpsComplianceController,
    OpsQuoteRequestsController,
    OpsCoordinatorsController,
    OpsCoordinatorWorkspaceController,
    OpsSuppliersController,
    OpsSupplierWorkspaceController,
    OpsBillingController,
    OpsClientController,
    OpsOnboardingController,
    OpsGuestController,
  ],
  providers: [EventOpsService, DemoStateService, InquiryWorkflowService],
})
export class EventOpsModule {}
