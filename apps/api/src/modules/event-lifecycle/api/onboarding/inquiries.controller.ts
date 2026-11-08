import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { PublicRateLimit, zodBody } from '@prism/kernel/shared';
import {
  createPrismInquirySchema,
  logInquiryOnBehalfSchema,
  type LogInquiryOnBehalfInput,
  mergeInquirySchema,
  updateInquiryCompanyNameSchema,
  type UpdateInquiryCompanyNameInput,
  setInquiryIntakePathSchema,
  type SetInquiryIntakePathInput,
  updateInquiryStatusSchema,
  uploadConformeSchema,
  type CreatePrismInquiryInput,
  type MergeInquiryInput,
  type PrismVerifiedEventActor,
  type UpdateInquiryStatusInput,
  type UploadConformeInput,
} from '@prism/types';
import { mapDocument, mapInquiry, mapOnboardingEvent, mapPublicInquiryReceipt } from '../../application/onboarding/inquiry.mappers';
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
    return this.inquiryWorkflowService.listInquiries({}, this.inquiryWorkflowContext(), verifiedActor);
  }

  @Post('log-on-behalf')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  logOnBehalf(
    @Body(zodBody(logInquiryOnBehalfSchema)) dto: LogInquiryOnBehalfInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.inquiryWorkflowService.logInquiryOnBehalf(dto, {}, this.inquiryWorkflowContext(), verifiedActor);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @PublicRateLimit('publicSubmission')
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

  @Get(':inquiryId/company-name-changes')
  @UseGuards(EventSessionGuard)
  async companyNameChanges(@Param('inquiryId') inquiryId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'company name history');
    return this.inquiriesService.listCompanyNameChanges(inquiryId);
  }

  @Patch(':inquiryId/company-name')
  @UseGuards(EventSessionGuard)
  async updateCompanyName(
    @Param('inquiryId') inquiryId: string,
    @Body(zodBody(updateInquiryCompanyNameSchema)) dto: UpdateInquiryCompanyNameInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.inquiriesService.updateCompanyName(inquiryId, dto, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Get(':inquiryId/pre-conforme-workspace')
  @UseGuards(EventSessionGuard)
  findPreConformeWorkspace(@Param('inquiryId') inquiryId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.inquiriesService.findPreConformeWorkspace(inquiryId, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Post(':inquiryId/pre-conforme-workspace')
  @UseGuards(EventSessionGuard)
  ensurePreConformeWorkspace(@Param('inquiryId') inquiryId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.inquiriesService.ensurePreConformeWorkspace(inquiryId, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Patch(':inquiryId/intake-path')
  @UseGuards(EventSessionGuard)
  async setIntakePath(
    @Param('inquiryId') inquiryId: string,
    @Body(zodBody(setInquiryIntakePathSchema)) dto: SetInquiryIntakePathInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.inquiriesService.setIntakePath(inquiryId, dto, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Post(':inquiryId/merge')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  mergeInquiry(
    @Param('inquiryId') inquiryId: string,
    @Body(zodBody(mergeInquirySchema)) dto: MergeInquiryInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.inquiryWorkflowService.mergeInquiry(inquiryId, dto, this.inquiryWorkflowContext(), verifiedActor);
  }

  @Post(':inquiryId/conforme-reminders')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  sendConformeReminder(@Param('inquiryId') inquiryId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.inquiryWorkflowService.sendConformeReminder(inquiryId, this.inquiryWorkflowContext(), verifiedActor);
  }

  @Post(':inquiryId/portal-invitation/resend')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EventSessionGuard)
  resendPortalInvitation(@Param('inquiryId') inquiryId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.inquiryWorkflowService.resendPortalInvitation(inquiryId, this.inquiryWorkflowContext(), verifiedActor);
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
