import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  AddSupplierQuoteDto,
  AiGovernanceDryRunDto,
  ApproveBillingSourceDto,
  ArchiveEventDto,
  ChangeSupplierTierDto,
  CreateBillingSourceDto,
  CreateComplianceRuleDto,
  CreateCoordinatorAssignmentDto,
  CreateEventDayTaskDto,
  CreateFloorPlanDraftDto,
  CreateFloorPlanPreferenceDto,
  CreateInquiryDto,
  CreateSupplierCertificationDto,
  CreateSupplierDto,
  CreateSupplierReviewDto,
  CreateUrgentIssueDto,
  CreatePrivacyRequestDto,
  SampleActorDto,
  ExecutePrivacyRequestDto,
  EscalateLiveOpsRecordDto,
  ExportAuditLogsDto,
  FloorPlanSnapshotQueryDto,
  GuestCheckInDto,
  GuestFeedbackDto,
  ListAuditLogsDto,
  LoginDto,
  MarkPaymentDto,
  RecordPaymentDto,
  RequestApprovalDto,
  RequestSupplierQuotesDto,
  ResolveComplianceDto,
  ReplaceCoordinatorAssignmentDto,
  ReviewPrivacyRequestDto,
  SubmitSupplierQuoteDto,
  SubmitBriefingDto,
  SupplierContractUploadDto,
  SupplierEventStatusDto,
  SupplierReadinessDto,
  UpdateCoordinatorAttendanceDto,
  UpdateComplianceRuleDto,
  UpdateEventDayTaskDto,
  UpdateUrgentIssueDto,
  UpdateSupplierDto,
  UpdateInquiryStatusDto,
  UploadConformeDto,
  VerifySupplierStatusDto,
} from '../dto/event-ops.dto';
import { EventOpsService } from '../event-ops.service';

@Controller('inquiries')
export class OpsInquiriesController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get()
  list(@Query() actor: SampleActorDto) {
    return this.eventOpsService.listInquiries(actor);
  }

  @Post('log-on-behalf')
  @HttpCode(HttpStatus.CREATED)
  logOnBehalf(@Body() dto: CreateInquiryDto, @Query() actor: SampleActorDto) {
    return this.eventOpsService.logInquiryOnBehalf(dto, actor);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateInquiryDto) {
    return this.eventOpsService.createInquiry(dto);
  }

  @Patch(':inquiryId/status')
  updateStatus(@Param('inquiryId') inquiryId: string, @Body() dto: UpdateInquiryStatusDto) {
    return this.eventOpsService.updateInquiryStatus(inquiryId, dto);
  }

  @Post(':inquiryId/conforme-reminders')
  @HttpCode(HttpStatus.CREATED)
  sendConformeReminder(@Param('inquiryId') inquiryId: string) {
    return this.eventOpsService.sendConformeReminder(inquiryId);
  }

  @Post(':inquiryId/conforme')
  @HttpCode(HttpStatus.CREATED)
  uploadConforme(@Param('inquiryId') inquiryId: string, @Body() dto: UploadConformeDto) {
    return this.eventOpsService.uploadConforme(inquiryId, dto);
  }
}

