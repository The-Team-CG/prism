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

@Controller('ai')
export class OpsAiController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Post('governance/dry-run')
  @HttpCode(HttpStatus.CREATED)
  dryRun(@Body() dto: AiGovernanceDryRunDto) {
    return this.eventOpsService.runAiGovernanceDryRun(dto);
  }

  @Post('pare/trigger/:requestId')
  @HttpCode(HttpStatus.CREATED)
  pareManualTrigger(@Param('requestId') requestId: string) {
    return this.eventOpsService.withdrawSupplier(requestId, 'Manual PARE trigger via API', {
      actorRole: 'pmcm_admin',
      actorName: 'PMCM Admin',
    });
  }

  @Get('pare/pending')
  pareGetPending(@Query('eventId') eventId?: string) {
    return this.eventOpsService.pareGetPendingApprovals(eventId);
  }

  @Patch('pare/:approvalRecordId/approve')
  pareApprove(
    @Param('approvalRecordId') approvalRecordId: string,
    @Query('approvedBy') approvedBy = 'PMCM Admin',
  ) {
    return this.eventOpsService.pareApprove(approvalRecordId, approvedBy);
  }

  @Patch('pare/:approvalRecordId/reject')
  pareReject(
    @Param('approvalRecordId') approvalRecordId: string,
    @Query('rejectedBy') rejectedBy = 'PMCM Admin',
  ) {
    return this.eventOpsService.pareReject(approvalRecordId, rejectedBy);
  }
}

