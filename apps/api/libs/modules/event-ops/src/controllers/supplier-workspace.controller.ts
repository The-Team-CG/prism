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

@Controller('supplier')
export class OpsSupplierWorkspaceController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get('workspace')
  getSupplierWorkspace(@Query() actor: SampleActorDto) {
    return this.eventOpsService.listSupplierWorkspace(actor);
  }

  @Get('readiness-board')
  readinessBoard(@Query() actor: SampleActorDto) {
    return this.eventOpsService.listSupplierReadinessBoard(actor);
  }

  @Patch('quote-requests/:requestId/assignment/confirm')
  confirmAssignment(@Param('requestId') requestId: string, @Query() actor: SampleActorDto) {
    return this.eventOpsService.confirmSupplierAssignment(requestId, actor);
  }

  @Patch('quote-requests/:requestId/readiness/confirm')
  confirmReadiness(
    @Param('requestId') requestId: string,
    @Body() dto: SupplierReadinessDto,
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.confirmSupplierReadiness(requestId, dto, actor);
  }

  @Post('quote-requests/:requestId/contract')
  @HttpCode(HttpStatus.CREATED)
  uploadContract(
    @Param('requestId') requestId: string,
    @Body() dto: SupplierContractUploadDto,
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.uploadSupplierContract(requestId, dto, actor);
  }

  @Patch('quote-requests/:requestId/event-status')
  updateEventStatus(
    @Param('requestId') requestId: string,
    @Body() dto: SupplierEventStatusDto,
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.updateSupplierEventStatus(requestId, dto, actor);
  }
}

