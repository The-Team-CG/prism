import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  AiGovernanceDryRunDto,
  ChangeSupplierTierDto,
  CreateEventDayTaskDto,
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
  GuestCheckInDto,
  GuestFeedbackDto,
  ListAuditLogsDto,
  LoginDto,
  RequestApprovalDto,
  ReplaceCoordinatorAssignmentDto,
  ReviewPrivacyRequestDto,
  SubmitSupplierQuoteDto,
  SupplierContractUploadDto,
  SupplierEventStatusDto,
  SupplierReadinessDto,
  UpdateCoordinatorAttendanceDto,
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


  @Get(':eventId/defense-readiness')
  defenseReadiness(@Param('eventId') eventId: string, @Query() actor: SampleActorDto) {
    return this.eventOpsService.getDefenseReadiness(eventId, actor);
  }

  @Get(':eventId/live-ops')
  liveOps(@Param('eventId') eventId: string, @Query() actor: SampleActorDto) {
    return this.eventOpsService.getEventLiveOps(eventId, actor);
  }

  @Get(':eventId/event-day/status-feed')
  statusFeed(@Param('eventId') eventId: string, @Query() actor: SampleActorDto) {
    return this.eventOpsService.getEventDayStatusFeed(eventId, actor);
  }

  @Post(':eventId/event-day/tasks')
  @HttpCode(HttpStatus.CREATED)
  createEventDayTask(
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventDayTaskDto,
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.createEventDayTask(eventId, dto, actor);
  }

  @Patch(':eventId/event-day/tasks/:taskId')
  updateEventDayTask(
    @Param('eventId') eventId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateEventDayTaskDto,
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.updateEventDayTask(eventId, taskId, dto, actor);
  }

  @Post(':eventId/event-day/tasks/:taskId/escalate')
  @HttpCode(HttpStatus.OK)
  escalateEventDayTask(
    @Param('eventId') eventId: string,
    @Param('taskId') taskId: string,
    @Body() dto: EscalateLiveOpsRecordDto,
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.escalateEventDayTask(eventId, taskId, dto, actor);
  }

  @Post(':eventId/urgent-issues')
  @HttpCode(HttpStatus.CREATED)
  createUrgentIssue(
    @Param('eventId') eventId: string,
    @Body() dto: CreateUrgentIssueDto,
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.createUrgentIssue(eventId, dto, actor);
  }

  @Patch(':eventId/urgent-issues/:issueId')
  updateUrgentIssue(
    @Param('eventId') eventId: string,
    @Param('issueId') issueId: string,
    @Body() dto: UpdateUrgentIssueDto,
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.updateUrgentIssue(eventId, issueId, dto, actor);
  }

  @Post(':eventId/urgent-issues/:issueId/escalate')
  @HttpCode(HttpStatus.OK)
  escalateUrgentIssue(
    @Param('eventId') eventId: string,
    @Param('issueId') issueId: string,
    @Body() dto: EscalateLiveOpsRecordDto,
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.escalateUrgentIssue(eventId, issueId, dto, actor);
  }

  @Patch(':eventId/coordinators/:assignmentId/status')
  updateCoordinatorAttendance(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateCoordinatorAttendanceDto,
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.updateCoordinatorAttendance(eventId, assignmentId, dto, actor);
  }

  @Post(':eventId/coordinators/:assignmentId/replace')
  @HttpCode(HttpStatus.OK)
  replaceCoordinatorAssignment(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: ReplaceCoordinatorAssignmentDto,
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.replaceCoordinatorAssignment(eventId, assignmentId, dto, actor);
  }

  @Patch(':eventId/supplier-status/:requestId/verify')
  verifySupplierStatus(
    @Param('eventId') eventId: string,
    @Param('requestId') requestId: string,
    @Body() dto: VerifySupplierStatusDto,
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.verifySupplierEventStatus(eventId, requestId, dto, actor);
  }


  @Patch(':eventId/quote-requests/:requestId/withdraw')
  withdrawSupplier(
    @Param('eventId') _eventId: string,
    @Param('requestId') requestId: string,
    @Body() dto: { reason?: string } = {},
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.withdrawSupplier(requestId, dto.reason ?? 'Withdrawn by PMCM Admin', actor);
  }

}
