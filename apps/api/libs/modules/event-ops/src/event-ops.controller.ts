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
} from './dto/event-ops.dto';
import { EventOpsService } from './event-ops.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get('state')
  state() {
    return this.eventOpsService.state();
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  reset() {
    return this.eventOpsService.resetDemo();
  }

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  seed() {
    return this.eventOpsService.seedDemoState();
  }
}

@Controller('auth')
export class OpsAuthController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.eventOpsService.login(dto.email, dto.password);
  }

  @Post('approval-requests')
  @HttpCode(HttpStatus.CREATED)
  requestApproval(@Body() dto: RequestApprovalDto) {
    return this.eventOpsService.requestApproval(dto);
  }

  @Get('approval-requests')
  listApprovalRequests() {
    return this.eventOpsService.listApprovalRequests();
  }

  @Get('users/:userId/login-history')
  listLoginHistory(@Param('userId') userId: string) {
    return this.eventOpsService.listLoginHistory(userId);
  }

  @Patch('approval-requests/:requestId/approve')
  approveApprovalRequest(@Param('requestId') requestId: string) {
    return this.eventOpsService.approveApprovalRequest(requestId);
  }

  @Patch('approval-requests/:requestId/decline')
  declineApprovalRequest(@Param('requestId') requestId: string) {
    return this.eventOpsService.declineApprovalRequest(requestId);
  }
}

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
  listAlerts(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listSecurityAlerts(actor);
  }

  @Get('integrity')
  integrity(@Query() actor: DemoActorDto) {
    return this.eventOpsService.verifyAuditIntegrity(actor);
  }
}

@Controller('privacy')
export class OpsPrivacyController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get('inventory')
  inventory(@Query() query: DemoActorDto & { eventId?: string }) {
    return this.eventOpsService.getPrivacyInventory(query, query);
  }

  @Get('retention-policies')
  retentionPolicies(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listPrivacyRetentionPolicies(actor);
  }

  @Get('requests')
  requests(@Query() query: DemoActorDto & { eventId?: string; status?: string }) {
    return this.eventOpsService.listPrivacyRequests(query, query);
  }

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  createRequest(@Body() dto: CreatePrivacyRequestDto, @Query() actor: DemoActorDto) {
    return this.eventOpsService.createPrivacyRequest(dto, actor);
  }

  @Patch('requests/:requestId/review')
  reviewRequest(@Param('requestId') requestId: string, @Body() dto: ReviewPrivacyRequestDto, @Query() actor: DemoActorDto) {
    return this.eventOpsService.reviewPrivacyRequest(requestId, dto, actor);
  }

  @Post('requests/:requestId/execute')
  @HttpCode(HttpStatus.OK)
  executeRequest(@Param('requestId') requestId: string, @Body() dto: ExecutePrivacyRequestDto, @Query() actor: DemoActorDto) {
    return this.eventOpsService.executePrivacyRequest(requestId, dto, actor);
  }
}

@Controller('notifications')
export class OpsNotificationsController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Post(':notificationId/acknowledge')
  @HttpCode(HttpStatus.OK)
  acknowledge(@Param('notificationId') notificationId: string) {
    return this.eventOpsService.acknowledgeNotification(notificationId);
  }
}

@Controller('inquiries')
export class OpsInquiriesController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get()
  list(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listInquiries(actor);
  }

  @Post('log-on-behalf')
  @HttpCode(HttpStatus.CREATED)
  logOnBehalf(@Body() dto: CreateInquiryDto, @Query() actor: DemoActorDto) {
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

@Controller('suppliers')
export class OpsSuppliersController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get('categories')
  listCategories(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listSupplierCategories(actor);
  }

  @Get()
  list(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listSuppliers(actor);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSupplierDto, @Query() actor: DemoActorDto) {
    return this.eventOpsService.createSupplier(dto, actor);
  }

  @Patch(':supplierId')
  update(@Param('supplierId') supplierId: string, @Body() dto: UpdateSupplierDto, @Query() actor: DemoActorDto) {
    return this.eventOpsService.updateSupplier(supplierId, dto, actor);
  }

  @Patch(':supplierId/tier')
  changeTier(
    @Param('supplierId') supplierId: string,
    @Body() dto: ChangeSupplierTierDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.changeSupplierTier(supplierId, dto, actor);
  }

  @Post(':supplierId/reviews')
  @HttpCode(HttpStatus.CREATED)
  addReview(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierReviewDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.addSupplierReview(supplierId, dto, actor);
  }

  @Post(':supplierId/certifications')
  @HttpCode(HttpStatus.CREATED)
  addCertification(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierCertificationDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.addSupplierCertification(supplierId, dto, actor);
  }
}

@Controller('quote-requests')
export class OpsQuoteRequestsController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get(':token')
  getRequest(@Param('token') token: string) {
    return this.eventOpsService.getQuoteRequestByToken(token);
  }

  @Post(':token/quote')
  @HttpCode(HttpStatus.CREATED)
  submitQuote(@Param('token') token: string, @Body() dto: SubmitSupplierQuoteDto) {
    return this.eventOpsService.submitSupplierQuoteByToken(token, dto);
  }

  @Patch(':token/quote')
  reviseQuote(@Param('token') token: string, @Body() dto: SubmitSupplierQuoteDto) {
    return this.eventOpsService.reviseSupplierQuoteByToken(token, dto);
  }
}

@Controller('supplier')
export class OpsSupplierWorkspaceController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get('workspace')
  workspace(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listSupplierWorkspace(actor);
  }

  @Patch('quote-requests/:requestId/assignment/confirm')
  confirmAssignment(@Param('requestId') requestId: string, @Query() actor: DemoActorDto) {
    return this.eventOpsService.confirmSupplierAssignment(requestId, actor);
  }

  @Patch('quote-requests/:requestId/readiness/confirm')
  confirmReadiness(
    @Param('requestId') requestId: string,
    @Body() dto: SupplierReadinessDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.confirmSupplierReadiness(requestId, dto, actor);
  }

  @Post('quote-requests/:requestId/contract')
  @HttpCode(HttpStatus.CREATED)
  uploadContract(
    @Param('requestId') requestId: string,
    @Body() dto: SupplierContractUploadDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.uploadSupplierContract(requestId, dto, actor);
  }

  @Patch('quote-requests/:requestId/event-status')
  updateEventStatus(
    @Param('requestId') requestId: string,
    @Body() dto: SupplierEventStatusDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.updateSupplierEventStatus(requestId, dto, actor);
  }
}

@Controller('coordinator')
export class OpsCoordinatorWorkspaceController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get('workspace')
  workspace(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listCoordinatorWorkspace(actor);
  }

  @Get('events/:eventId/role-view')
  roleView(@Param('eventId') eventId: string, @Query() actor: DemoActorDto) {
    return this.eventOpsService.getCoordinatorRoleView(eventId, actor);
  }
}

@Controller('coordinators')
export class OpsCoordinatorsController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get()
  list(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listCoordinators(actor);
  }
}

@Controller('billing')
export class OpsBillingController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get()
  list(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listBilling(actor);
  }
}

@Controller('onboarding')
export class OpsOnboardingController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get()
  list(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listOnboarding(actor);
  }
}

@Controller('client')
export class OpsClientController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get('workspace')
  workspace(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listClientWorkspace(actor);
  }
}

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

@Controller('ai')
export class OpsAiController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Post('governance/dry-run')
  @HttpCode(HttpStatus.CREATED)
  dryRun(@Body() dto: AiGovernanceDryRunDto) {
    return this.eventOpsService.runAiGovernanceDryRun(dto);
  }
}
