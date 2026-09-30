import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  createPrismInquirySchema,
  updateInquiryStatusSchema,
  uploadConformeSchema,
  type CreatePrismInquiryInput,
  type PrismVerifiedEventActor,
  type UpdateInquiryStatusInput,
  type UploadConformeInput,
} from '@prism/types';
import { ActorContextDto } from './inquiry.dto';
import { mapDocument, mapInquiry, mapOnboardingEvent } from '../../application/onboarding/inquiry.mappers';
import { InquiriesService } from '../../application/onboarding/inquiries.service';
import { InquiryWorkflowService } from '../../application/onboarding/inquiry-workflow.service';

@Controller('inquiries')
export class OpsInquiriesController {
  constructor(
    private readonly inquiriesService: InquiriesService,
    private readonly inquiryWorkflowService: InquiryWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  private inquiryWorkflowContext() {
    return {
      inquiriesService: this.inquiriesService,
      resolveActor: (input?: ActorContextDto, verifiedActor?: PrismVerifiedEventActor) =>
        this.eventAccessPolicyService.resolveActor(input, verifiedActor),
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
    return this.inquiryWorkflowService.listInquiries({}, this.inquiryWorkflowContext(), verifiedActor);
  }

  @Post('log-on-behalf')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  logOnBehalf(
    @Body(zodBody(createPrismInquirySchema)) dto: CreatePrismInquiryInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.inquiryWorkflowService.logInquiryOnBehalf(dto, {}, this.inquiryWorkflowContext(), verifiedActor);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body(zodBody(createPrismInquirySchema)) dto: CreatePrismInquiryInput) {
    return this.inquiryWorkflowService.createInquiry(dto, this.inquiryWorkflowContext());
  }

  @Patch(':inquiryId/status')
  @UseGuards(EventSessionGuard)
  updateStatus(
    @Param('inquiryId') inquiryId: string,
    @Body(zodBody(updateInquiryStatusSchema)) dto: UpdateInquiryStatusInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.inquiryWorkflowService.updateInquiryStatus(inquiryId, dto, this.inquiryWorkflowContext(), verifiedActor);
  }

  @Post(':inquiryId/conforme-reminders')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  sendConformeReminder(@Param('inquiryId') inquiryId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.inquiryWorkflowService.sendConformeReminder(inquiryId, this.inquiryWorkflowContext(), verifiedActor);
  }

  @Post(':inquiryId/conforme')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  uploadConforme(
    @Param('inquiryId') inquiryId: string,
    @Body(zodBody(uploadConformeSchema)) dto: UploadConformeInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.inquiryWorkflowService.uploadConforme(inquiryId, dto, {}, this.inquiryWorkflowContext(), verifiedActor);
  }
}
