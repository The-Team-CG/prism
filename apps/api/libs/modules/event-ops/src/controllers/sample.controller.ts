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

@Controller('sample')
export class SampleController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  /**
   * Compatibility aggregate for local demos, seed verification, and reset flows.
   * New role surfaces should use scoped controllers such as /client/workspace,
   * /pmcm/dashboard, /supplier/workspace, /events/:id, and /billing.
   */
  @Get('state')
  state() {
    return this.eventOpsService.state();
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  reset() {
    return this.eventOpsService.resetSample();
  }

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  seed() {
    return this.eventOpsService.seedSampleState();
  }
}

