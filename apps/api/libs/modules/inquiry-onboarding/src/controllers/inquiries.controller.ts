import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { OpsUserRole } from '@prism/modules/event-core';
import { CreateInquiryDto, SampleActorDto, UpdateInquiryStatusDto, UploadConformeDto } from '../dto/inquiry.dto';
import { mapDocument, mapInquiry } from '../mappers/inquiry.mappers';
import { InquiriesService } from '../services/inquiries.service';
import { InquiryWorkflowService } from '../services/inquiry-workflow.service';

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
      resolveActor: (input?: SampleActorDto) => this.eventAccessPolicyService.resolveActor(input),
      requireActorRole: (actor: ReturnType<EventAccessPolicyService['resolveActor']>, roles: OpsUserRole[], resource: string) =>
        this.eventAccessPolicyService.requireActorRole(actor, roles, resource),
      allowedAdminRoles: [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      mapInquiry: (inquiry: unknown) => mapInquiry(inquiry as Parameters<typeof mapInquiry>[0]),
      mapDocument: (document: unknown) => mapDocument(document as Parameters<typeof mapDocument>[0]),
    };
  }

  @Get()
  list(@Query() actor: SampleActorDto) {
    return this.inquiryWorkflowService.listInquiries(actor, this.inquiryWorkflowContext());
  }

  @Post('log-on-behalf')
  @HttpCode(HttpStatus.CREATED)
  logOnBehalf(@Body() dto: CreateInquiryDto, @Query() actor: SampleActorDto) {
    return this.inquiryWorkflowService.logInquiryOnBehalf(dto, actor, this.inquiryWorkflowContext());
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateInquiryDto) {
    return this.inquiryWorkflowService.createInquiry(dto, this.inquiryWorkflowContext());
  }

  @Patch(':inquiryId/status')
  updateStatus(@Param('inquiryId') inquiryId: string, @Body() dto: UpdateInquiryStatusDto) {
    return this.inquiryWorkflowService.updateInquiryStatus(inquiryId, dto, this.inquiryWorkflowContext());
  }

  @Post(':inquiryId/conforme-reminders')
  @HttpCode(HttpStatus.CREATED)
  sendConformeReminder(@Param('inquiryId') inquiryId: string) {
    return this.inquiryWorkflowService.sendConformeReminder(inquiryId, this.inquiryWorkflowContext());
  }

  @Post(':inquiryId/conforme')
  @HttpCode(HttpStatus.CREATED)
  uploadConforme(@Param('inquiryId') inquiryId: string, @Body() dto: UploadConformeDto) {
    return this.inquiryWorkflowService.uploadConforme(inquiryId, dto, this.inquiryWorkflowContext());
  }
}
