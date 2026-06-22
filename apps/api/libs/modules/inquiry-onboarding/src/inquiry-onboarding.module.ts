import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { CLIENT_ONBOARDING_COMMANDS, INQUIRY_COMMANDS } from './ports/inquiry-onboarding.tokens';
import { OpsInquiriesController } from './controllers/inquiries.controller';
import { OpsOnboardingController } from './controllers/onboarding.controller';
import { ClientOnboardingWorkflowService } from './services/client-onboarding-workflow.service';
import { InquiriesService } from './services/inquiries.service';
import { InquiryWorkflowService } from './services/inquiry-workflow.service';

@Module({
  imports: [DatabaseModule, EventCoreModule, TrustOpsModule, NotificationOpsModule, AccessControlModule],
  controllers: [OpsInquiriesController, OpsOnboardingController],
  providers: [
    InquiriesService,
    InquiryWorkflowService,
    ClientOnboardingWorkflowService,
    { provide: INQUIRY_COMMANDS, useExisting: InquiriesService },
    { provide: CLIENT_ONBOARDING_COMMANDS, useExisting: ClientOnboardingWorkflowService },
  ],
  exports: [
    InquiriesService,
    InquiryWorkflowService,
    ClientOnboardingWorkflowService,
    INQUIRY_COMMANDS,
    CLIENT_ONBOARDING_COMMANDS,
  ],
})
export class InquiryOnboardingModule {}
