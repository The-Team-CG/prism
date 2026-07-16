import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { EventSessionModule } from '@prism/modules/event-session';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { CLIENT_ONBOARDING_COMMANDS, INQUIRY_COMMANDS } from './ports/inquiry-onboarding.tokens';
import { OpsEventBriefingController } from './controllers/event-briefing.controller';
import { OpsInquiriesController } from './controllers/inquiries.controller';
import { OpsOnboardingController } from './controllers/onboarding.controller';
import { ClientOnboardingWorkflowService } from './services/client-onboarding-workflow.service';
import { InquiriesService } from './services/inquiries.service';
import { InquiryConformeReminderScheduler } from './services/inquiry-conforme-reminder.scheduler';
import { InquiryWorkflowService } from './services/inquiry-workflow.service';

@Module({
  imports: [DatabaseModule, EventCoreModule, TrustOpsModule, NotificationOpsModule, AccessControlModule, EventSessionModule],
  controllers: [OpsInquiriesController, OpsOnboardingController, OpsEventBriefingController],
  providers: [
    InquiriesService,
    InquiryWorkflowService,
    ClientOnboardingWorkflowService,
    InquiryConformeReminderScheduler,
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
