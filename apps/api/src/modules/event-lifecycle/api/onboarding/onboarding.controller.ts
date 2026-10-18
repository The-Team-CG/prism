import { Controller, Get, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { ActorContextDto } from './inquiry.dto';
import { mapDocument, mapInquiry, mapOnboardingEvent, mapPublicInquiryReceipt } from '../../application/onboarding/inquiry.mappers';
import { InquiriesService } from '../../application/onboarding/inquiries.service';
import { InquiryWorkflowService } from '../../application/onboarding/inquiry-workflow.service';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';

@Controller('onboarding')
export class OpsOnboardingController {
  constructor(
    private readonly inquiriesService: InquiriesService,
    private readonly inquiryWorkflowService: InquiryWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  private inquiryWorkflowContext() {
    return {
      inquiriesService: this.inquiriesService,
      resolveActor: this.eventAccessPolicyService.resolveActor.bind(this.eventAccessPolicyService),
      requireActorRole: this.eventAccessPolicyService.requireActorRole.bind(this.eventAccessPolicyService),
      allowedAdminRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      mapInquiry,
      mapPublicInquiry: mapPublicInquiryReceipt,
      mapDocument,
      mapEvent: mapOnboardingEvent,
    };
  }

  @Get()
  @UseGuards(EventSessionGuard)
  list(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.inquiryWorkflowService.listOnboarding({}, this.inquiryWorkflowContext(), verifiedActor);
  }
}
