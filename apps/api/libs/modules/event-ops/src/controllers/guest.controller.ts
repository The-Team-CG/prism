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
  DemoActorDto,
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

@Controller('guest')
export class OpsGuestController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get('events/:accessCode')
  eventByAccessCode(@Param('accessCode') accessCode: string) {
    return this.eventOpsService.getGuestEventByAccessCode(accessCode);
  }

  @Post('events/:accessCode/check-ins')
  @HttpCode(HttpStatus.CREATED)
  checkIn(@Param('accessCode') accessCode: string, @Body() dto: GuestCheckInDto) {
    return this.eventOpsService.checkInGuestByAccessCode(accessCode, dto);
  }

  @Post('events/:accessCode/feedback')
  @HttpCode(HttpStatus.CREATED)
  submitFeedback(@Param('accessCode') accessCode: string, @Body() dto: GuestFeedbackDto) {
    return this.eventOpsService.submitGuestFeedbackByAccessCode(accessCode, dto);
  }
}

