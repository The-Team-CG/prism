import { Controller, Get, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { ActorContextDto } from './inquiry.dto';
import { mapDocument, mapInquiry, mapOnboardingEvent } from '../../application/onboarding/inquiry.mappers';
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
      resolveActor: (input?: ActorContextDto) => this.eventAccessPolicyService.resolveActor(input),
      requireActorRole: (actor: ReturnType<EventAccessPolicyService['resolveActor']>, roles: OpsUserRole[], resource: string) =>
        this.eventAccessPolicyService.requireActorRole(actor, roles, resource),
      allowedAdminRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      mapInquiry: (inquiry: unknown) => mapInquiry(inquiry as Parameters<typeof mapInquiry>[0]),
      mapDocument: (document: unknown) => mapDocument(document as Parameters<typeof mapDocument>[0]),
      mapEvent: (event: unknown) => mapOnboardingEvent(event as Parameters<typeof mapOnboardingEvent>[0]),
    };
  }

  @Get()
  @UseGuards(EventSessionGuard)
  list(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.inquiryWorkflowService.listOnboarding({}, this.inquiryWorkflowContext(), verifiedActor);
  }
}
