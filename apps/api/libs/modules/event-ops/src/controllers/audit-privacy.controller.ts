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

@Controller('audit')
export class OpsAuditController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get('logs')
  listLogs(@Query() query: ListAuditLogsDto) {
    return this.eventOpsService.listAuditLogs(query, query);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  exportLogs(@Body() dto: ExportAuditLogsDto) {
    return this.eventOpsService.exportAuditLogs(dto, dto);
  }

  @Get('alerts')
  listAlerts(@Query() actor: SampleActorDto) {
    return this.eventOpsService.listSecurityAlerts(actor);
  }

  @Get('integrity')
  integrity(@Query() actor: SampleActorDto) {
    return this.eventOpsService.verifyAuditIntegrity(actor);
  }
}

@Controller('privacy')
export class OpsPrivacyController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get('inventory')
  inventory(@Query() query: SampleActorDto & { eventId?: string }) {
    return this.eventOpsService.getPrivacyInventory(query, query);
  }

  @Get('retention-policies')
  retentionPolicies(@Query() actor: SampleActorDto) {
    return this.eventOpsService.listPrivacyRetentionPolicies(actor);
  }

  @Get('requests')
  requests(@Query() query: SampleActorDto & { eventId?: string; status?: string }) {
    return this.eventOpsService.listPrivacyRequests(query, query);
  }

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  createRequest(@Body() dto: CreatePrivacyRequestDto, @Query() actor: SampleActorDto) {
    return this.eventOpsService.createPrivacyRequest(dto, actor);
  }

  @Patch('requests/:requestId/review')
  reviewRequest(@Param('requestId') requestId: string, @Body() dto: ReviewPrivacyRequestDto, @Query() actor: SampleActorDto) {
    return this.eventOpsService.reviewPrivacyRequest(requestId, dto, actor);
  }

  @Post('requests/:requestId/execute')
  @HttpCode(HttpStatus.OK)
  executeRequest(@Param('requestId') requestId: string, @Body() dto: ExecutePrivacyRequestDto, @Query() actor: SampleActorDto) {
    return this.eventOpsService.executePrivacyRequest(requestId, dto, actor);
  }
}

