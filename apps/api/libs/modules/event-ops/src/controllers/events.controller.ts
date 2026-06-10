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

@Controller('events')
export class OpsEventsController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get()
  list(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listEvents(actor);
  }

  @Get(':eventId')
  detail(@Param('eventId') eventId: string, @Query() actor: DemoActorDto) {
    return this.eventOpsService.getEventDetail(eventId, actor);
  }

  @Get(':eventId/defense-readiness')
  defenseReadiness(@Param('eventId') eventId: string, @Query() actor: DemoActorDto) {
    return this.eventOpsService.getDefenseReadiness(eventId, actor);
  }

  @Get(':eventId/live-ops')
  liveOps(@Param('eventId') eventId: string, @Query() actor: DemoActorDto) {
    return this.eventOpsService.getEventLiveOps(eventId, actor);
  }

  @Get(':eventId/event-day/status-feed')
  statusFeed(@Param('eventId') eventId: string, @Query() actor: DemoActorDto) {
    return this.eventOpsService.getEventDayStatusFeed(eventId, actor);
  }

  @Post(':eventId/event-day/tasks')
  @HttpCode(HttpStatus.CREATED)
  createEventDayTask(
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventDayTaskDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.createEventDayTask(eventId, dto, actor);
  }

  @Patch(':eventId/event-day/tasks/:taskId')
  updateEventDayTask(
    @Param('eventId') eventId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateEventDayTaskDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.updateEventDayTask(eventId, taskId, dto, actor);
  }

  @Post(':eventId/event-day/tasks/:taskId/escalate')
  @HttpCode(HttpStatus.OK)
  escalateEventDayTask(
    @Param('eventId') eventId: string,
    @Param('taskId') taskId: string,
    @Body() dto: EscalateLiveOpsRecordDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.escalateEventDayTask(eventId, taskId, dto, actor);
  }

  @Post(':eventId/urgent-issues')
  @HttpCode(HttpStatus.CREATED)
  createUrgentIssue(
    @Param('eventId') eventId: string,
    @Body() dto: CreateUrgentIssueDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.createUrgentIssue(eventId, dto, actor);
  }

  @Patch(':eventId/urgent-issues/:issueId')
  updateUrgentIssue(
    @Param('eventId') eventId: string,
    @Param('issueId') issueId: string,
    @Body() dto: UpdateUrgentIssueDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.updateUrgentIssue(eventId, issueId, dto, actor);
  }

  @Post(':eventId/urgent-issues/:issueId/escalate')
  @HttpCode(HttpStatus.OK)
  escalateUrgentIssue(
    @Param('eventId') eventId: string,
    @Param('issueId') issueId: string,
    @Body() dto: EscalateLiveOpsRecordDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.escalateUrgentIssue(eventId, issueId, dto, actor);
  }

  @Patch(':eventId/coordinators/:assignmentId/status')
  updateCoordinatorAttendance(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateCoordinatorAttendanceDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.updateCoordinatorAttendance(eventId, assignmentId, dto, actor);
  }

  @Post(':eventId/coordinators/:assignmentId/replace')
  @HttpCode(HttpStatus.OK)
  replaceCoordinatorAssignment(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: ReplaceCoordinatorAssignmentDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.replaceCoordinatorAssignment(eventId, assignmentId, dto, actor);
  }

  @Patch(':eventId/supplier-status/:requestId/verify')
  verifySupplierStatus(
    @Param('eventId') eventId: string,
    @Param('requestId') requestId: string,
    @Body() dto: VerifySupplierStatusDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.verifySupplierEventStatus(eventId, requestId, dto, actor);
  }

  @Post(':eventId/floorplans')
  @HttpCode(HttpStatus.CREATED)
  createFloorPlanDraft(
    @Param('eventId') eventId: string,
    @Body() dto: CreateFloorPlanDraftDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.createFloorPlanDraft(eventId, dto, actor);
  }

  @Post(':eventId/floorplan-preferences')
  @HttpCode(HttpStatus.CREATED)
  createFloorPlanPreference(
    @Param('eventId') eventId: string,
    @Body() dto: CreateFloorPlanPreferenceDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.createFloorPlanPreference(eventId, dto, actor);
  }

  @Post(':eventId/floorplans/:draftId/submit')
  @HttpCode(HttpStatus.OK)
  submitFloorPlanDraft(
    @Param('eventId') eventId: string,
    @Param('draftId') draftId: string,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.submitFloorPlanDraft(eventId, draftId, actor);
  }

  @Post(':eventId/floorplans/:draftId/approve')
  @HttpCode(HttpStatus.OK)
  approveFloorPlanDraft(
    @Param('eventId') eventId: string,
    @Param('draftId') draftId: string,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.approveFloorPlanDraft(eventId, draftId, actor);
  }

  @Get(':eventId/floorplans/:draftId/snapshot')
  getFloorPlanSnapshot(
    @Param('eventId') eventId: string,
    @Param('draftId') draftId: string,
    @Query() query: FloorPlanSnapshotQueryDto,
  ) {
    const { type = 'approved', ...actor } = query;
    return this.eventOpsService.getFloorPlanSnapshot(eventId, draftId, type, actor);
  }

  @Post(':eventId/briefing')
  @HttpCode(HttpStatus.CREATED)
  submitBriefing(@Param('eventId') eventId: string, @Body() dto: SubmitBriefingDto) {
    return this.eventOpsService.submitBriefing(eventId, dto);
  }

  @Post(':eventId/supplier-quotes')
  @HttpCode(HttpStatus.CREATED)
  addSupplierQuote(@Param('eventId') eventId: string, @Body() dto: AddSupplierQuoteDto) {
    return this.eventOpsService.addSupplierQuote(eventId, dto);
  }

  @Post(':eventId/quote-requests')
  @HttpCode(HttpStatus.CREATED)
  requestSupplierQuotes(@Param('eventId') eventId: string, @Body() dto: RequestSupplierQuotesDto) {
    return this.eventOpsService.requestSupplierQuotes(eventId, dto);
  }

  @Patch(':eventId/supplier-quotes/:quoteId/select')
  selectSupplierQuote(@Param('eventId') eventId: string, @Param('quoteId') quoteId: string) {
    return this.eventOpsService.selectSupplierQuote(eventId, quoteId);
  }

  @Patch(':eventId/quote-requests/:requestId/withdraw')
  withdrawSupplier(
    @Param('eventId') _eventId: string,
    @Param('requestId') requestId: string,
    @Body() dto: { reason?: string } = {},
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.withdrawSupplier(requestId, dto.reason ?? 'Withdrawn by PMCM Admin', actor);
  }

  @Post(':eventId/compliance')
  @HttpCode(HttpStatus.CREATED)
  runCompliance(@Param('eventId') eventId: string, @Body() dto: { phase?: string } = {}) {
    return this.eventOpsService.runCompliance(eventId, dto);
  }

  @Patch(':eventId/compliance/:checkId')
  resolveCompliance(
    @Param('eventId') eventId: string,
    @Param('checkId') checkId: string,
    @Body() dto: ResolveComplianceDto,
  ) {
    return this.eventOpsService.resolveCompliance(eventId, checkId, dto);
  }

  @Post(':eventId/billing-source')
  @HttpCode(HttpStatus.CREATED)
  createBillingSource(@Param('eventId') eventId: string, @Body() dto: CreateBillingSourceDto) {
    return this.eventOpsService.createBillingSource(eventId, dto);
  }

  @Patch(':eventId/billing-source/:sourceId/approve')
  approveBillingSource(
    @Param('eventId') eventId: string,
    @Param('sourceId') sourceId: string,
    @Body() dto: ApproveBillingSourceDto,
  ) {
    return this.eventOpsService.approveBillingSource(eventId, sourceId, dto);
  }

  @Post(':eventId/billing-statements/generate')
  @HttpCode(HttpStatus.CREATED)
  generateBillingStatement(@Param('eventId') eventId: string, @Body() dto: { sourceId?: string } = {}) {
    return this.eventOpsService.generateBillingStatement(eventId, dto.sourceId);
  }

  @Post(':eventId/coordinators')
  @HttpCode(HttpStatus.CREATED)
  assignCoordinator(
    @Param('eventId') eventId: string,
    @Body() dto: CreateCoordinatorAssignmentDto,
  ) {
    return this.eventOpsService.assignCoordinator(eventId, dto);
  }

  @Patch(':eventId/coordinators/:assignmentId/acknowledge')
  acknowledgeCoordinator(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.eventOpsService.acknowledgeCoordinator(eventId, assignmentId);
  }

  @Patch(':eventId/payments/:milestoneId')
  markPayment(
    @Param('eventId') eventId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: MarkPaymentDto,
  ) {
    return this.eventOpsService.markPayment(eventId, milestoneId, dto.status);
  }

  @Post(':eventId/payments/:milestoneId/records')
  @HttpCode(HttpStatus.CREATED)
  recordPayment(
    @Param('eventId') eventId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.eventOpsService.recordPayment(eventId, milestoneId, dto);
  }

  @Post(':eventId/billing-statements/:billingId/send')
  @HttpCode(HttpStatus.OK)
  sendBillingStatement(@Param('eventId') eventId: string, @Param('billingId') billingId: string) {
    return this.eventOpsService.sendBillingStatement(eventId, billingId);
  }

  @Patch(':eventId/post-event-documents/:documentId/complete')
  completePostEventDocument(
    @Param('eventId') eventId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.eventOpsService.completePostEventDocument(eventId, documentId);
  }

  @Get(':eventId/close-gates')
  closeGates(@Param('eventId') eventId: string) {
    return this.eventOpsService.getCloseGates(eventId);
  }

  @Post(':eventId/archive')
  @HttpCode(HttpStatus.OK)
  archiveEvent(@Param('eventId') eventId: string, @Body() dto: ArchiveEventDto = {}) {
    return this.eventOpsService.archiveEvent(eventId, dto);
  }

  @Get(':eventId/insights')
  eventInsights(@Param('eventId') eventId: string, @Query() actor: DemoActorDto) {
    return this.eventOpsService.listEventInsights(eventId, actor);
  }

  @Post(':eventId/insights/generate')
  @HttpCode(HttpStatus.CREATED)
  generateEventInsights(@Param('eventId') eventId: string) {
    return this.eventOpsService.generateEventInsights(eventId);
  }
}

@Controller('compliance')
export class OpsComplianceController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get('rules')
  listRules(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listComplianceRules(actor);
  }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  createRule(@Body() dto: CreateComplianceRuleDto, @Query() actor: DemoActorDto) {
    return this.eventOpsService.createComplianceRule(dto, actor);
  }

  @Patch('rules/:ruleId')
  updateRule(@Param('ruleId') ruleId: string, @Body() dto: UpdateComplianceRuleDto, @Query() actor: DemoActorDto) {
    return this.eventOpsService.updateComplianceRule(ruleId, dto, actor);
  }
}

