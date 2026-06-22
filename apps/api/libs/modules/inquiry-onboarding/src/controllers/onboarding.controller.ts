import { Controller, Get, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { OpsUserRole } from '@prism/modules/event-core';
import { SampleActorDto } from '../dto/inquiry.dto';
import { mapDocument, mapInquiry, mapOnboardingEvent } from '../mappers/inquiry.mappers';
import { InquiriesService } from '../services/inquiries.service';
import { InquiryWorkflowService } from '../services/inquiry-workflow.service';

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
      resolveActor: (input?: SampleActorDto) => this.eventAccessPolicyService.resolveActor(input),
      requireActorRole: (actor: ReturnType<EventAccessPolicyService['resolveActor']>, roles: OpsUserRole[], resource: string) =>
        this.eventAccessPolicyService.requireActorRole(actor, roles, resource),
      allowedAdminRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      mapInquiry: (inquiry: unknown) => mapInquiry(inquiry as Parameters<typeof mapInquiry>[0]),
      mapDocument: (document: unknown) => mapDocument(document as Parameters<typeof mapDocument>[0]),
      mapEvent: (event: unknown) => mapOnboardingEvent(event as Parameters<typeof mapOnboardingEvent>[0]),
    };
  }

  @Get()
  list(@Query() actor: SampleActorDto) {
    return this.inquiryWorkflowService.listOnboarding(actor, this.inquiryWorkflowContext());
  }
}
