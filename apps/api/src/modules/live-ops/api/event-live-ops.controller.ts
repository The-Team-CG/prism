import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards, Optional } from '@nestjs/common';
import { zodBody } from '@prism/kernel/shared';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import {
  createEventDayTaskSchema,
  createEventTaskReassignmentSchema,
  decideEventTaskReassignmentSchema,
  createUrgentIssueSchema,
  escalateLiveOpsRecordSchema,
  escalateEventDayTaskSchema,
  replaceCoordinatorAssignmentSchema,
  updateCoordinatorAttendanceSchema,
  updateEventDayTaskSchema,
  updateUrgentIssueSchema,
  verifySupplierStatusSchema,
  createEventScheduleDaySchema,
  createEventScheduleSegmentSchema,
  updateEventScheduleSegmentStatusSchema,
  createEventOperatorDesignationSchema,
  createEventHandoffSchema,
  createEventEodReportSchema,
  createEventEodReplySchema,
  type CreateEventDayTaskInput,
  type CreateEventTaskReassignmentInput,
  type DecideEventTaskReassignmentInput,
  type CreateUrgentIssueInput,
  type EscalateLiveOpsInput,
  type EscalateEventDayTaskInput,
  type ReplaceCoordinatorAssignmentInput,
  type UpdateCoordinatorAttendanceInput,
  type UpdateEventDayTaskInput,
  type UpdateUrgentIssueInput,
  type VerifySupplierStatusInput,
  type CreateEventScheduleDayInput,
  type CreateEventScheduleSegmentInput,
  type UpdateEventScheduleSegmentStatusInput,
  type CreateEventOperatorDesignationInput,
  type CreateEventHandoffInput,
  type CreateEventEodReportInput,
  type CreateEventEodReplyInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { EventLiveOpsCommandService } from '../application/event-live-ops-command.service';
import { EventLiveOpsReadService } from '../application/event-live-ops-read.service';
import { EventScheduleService } from '../application/event-schedule.service';

@Controller('events')
export class EventLiveOpsController {
  constructor(
    private readonly readService: EventLiveOpsReadService,
    private readonly commandService: EventLiveOpsCommandService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Optional() private readonly scheduleService?: EventScheduleService,
  ) {}

  @Get(':eventId/schedule')
  @UseGuards(EventSessionGuard)
  schedule(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.scheduleService!.getSchedule(eventId, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Post(':eventId/schedule/days')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  createScheduleDay(@Param('eventId') eventId: string, @Body(zodBody(createEventScheduleDaySchema)) dto: CreateEventScheduleDayInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.scheduleService!.createDay(eventId, dto, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Post(':eventId/schedule/days/:dayId/segments')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  createScheduleSegment(@Param('eventId') eventId: string, @Param('dayId') dayId: string, @Body(zodBody(createEventScheduleSegmentSchema)) dto: CreateEventScheduleSegmentInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.scheduleService!.createSegment(eventId, dayId, dto, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Patch(':eventId/schedule/segments/:segmentId/status')
  @UseGuards(EventSessionGuard)
  updateScheduleSegmentStatus(@Param('eventId') eventId: string, @Param('segmentId') segmentId: string, @Body(zodBody(updateEventScheduleSegmentStatusSchema)) dto: UpdateEventScheduleSegmentStatusInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.scheduleService!.updateSegmentStatus(eventId, segmentId, dto, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Get(':eventId/run-sheet')
  @UseGuards(EventSessionGuard)
  runSheet(@Param('eventId') eventId: string, @Query('dayId') dayId: string | undefined, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.scheduleService!.getRunSheet(eventId, dayId, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Get(':eventId/operator-designation')
  @UseGuards(EventSessionGuard)
  operatorDesignation(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.scheduleService!.getOperatorDesignation(eventId, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Post(':eventId/operator-designation')
  @UseGuards(EventSessionGuard)
  designateOperator(@Param('eventId') eventId: string, @Body(zodBody(createEventOperatorDesignationSchema)) dto: CreateEventOperatorDesignationInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.scheduleService!.designateOperator(eventId, dto, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Post(':eventId/handoffs')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  createHandoff(@Param('eventId') eventId: string, @Body(zodBody(createEventHandoffSchema)) dto: CreateEventHandoffInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.scheduleService!.createHandoff(eventId, dto, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Get(':eventId/eod-reports')
  @UseGuards(EventSessionGuard)
  listEodReports(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.scheduleService!.listEodReports(eventId, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Post(':eventId/eod-reports')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  submitEodReport(@Param('eventId') eventId: string, @Body(zodBody(createEventEodReportSchema)) dto: CreateEventEodReportInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.scheduleService!.submitEodReport(eventId, dto, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Post(':eventId/eod-reports/:reportId/replies')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  replyEodReport(@Param('eventId') eventId: string, @Param('reportId') reportId: string, @Body(zodBody(createEventEodReplySchema)) dto: CreateEventEodReplyInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.scheduleService!.replyToEodReport(eventId, reportId, dto, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Get(':eventId/live-ops')
  @UseGuards(EventSessionGuard)
  liveOps(
    @Param('eventId') eventId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.readService.getEventLiveOps(eventId, actor);
  }

  @Get(':eventId/event-day/status-feed')
  @UseGuards(EventSessionGuard)
  statusFeed(
    @Param('eventId') eventId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.readService.getEventDayStatusFeed(eventId, actor);
  }

  @Post(':eventId/event-day/tasks')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  createEventDayTask(
    @Param('eventId') eventId: string,
    @Body(zodBody(createEventDayTaskSchema)) dto: CreateEventDayTaskInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.commandService.createEventDayTask(eventId, dto, actor);
  }

  @Patch(':eventId/event-day/tasks/:taskId')
  @UseGuards(EventSessionGuard)
  updateEventDayTask(
    @Param('eventId') eventId: string,
    @Param('taskId') taskId: string,
    @Body(zodBody(updateEventDayTaskSchema)) dto: UpdateEventDayTaskInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.commandService.updateEventDayTask(eventId, taskId, dto, actor);
  }

  @Post(':eventId/event-day/tasks/:taskId/escalate')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  escalateEventDayTask(
    @Param('eventId') eventId: string,
    @Param('taskId') taskId: string,
    @Body(zodBody(escalateEventDayTaskSchema)) dto: EscalateEventDayTaskInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.commandService.escalateEventDayTask(eventId, taskId, dto, actor);
  }

  @Post(':eventId/urgent-issues')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  createUrgentIssue(
    @Param('eventId') eventId: string,
    @Body(zodBody(createUrgentIssueSchema)) dto: CreateUrgentIssueInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.commandService.createUrgentIssue(eventId, dto, actor);
  }

  @Patch(':eventId/urgent-issues/:issueId')
  @UseGuards(EventSessionGuard)
  updateUrgentIssue(
    @Param('eventId') eventId: string,
    @Param('issueId') issueId: string,
    @Body(zodBody(updateUrgentIssueSchema)) dto: UpdateUrgentIssueInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.commandService.updateUrgentIssue(eventId, issueId, dto, actor);
  }

  @Post(':eventId/urgent-issues/:issueId/escalate')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  escalateUrgentIssue(
    @Param('eventId') eventId: string,
    @Param('issueId') issueId: string,
    @Body(zodBody(escalateLiveOpsRecordSchema)) dto: EscalateLiveOpsInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.commandService.escalateUrgentIssue(eventId, issueId, dto, actor);
  }

  @Patch(':eventId/coordinators/:assignmentId/status')
  @UseGuards(EventSessionGuard)
  updateCoordinatorAttendance(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
    @Body(zodBody(updateCoordinatorAttendanceSchema)) dto: UpdateCoordinatorAttendanceInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.commandService.updateCoordinatorAttendance(eventId, assignmentId, dto, actor);
  }

  @Get(':eventId/event-day/task-reassignments')
  @UseGuards(EventSessionGuard)
  listTaskReassignmentRequests(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.commandService.listTaskReassignmentRequests(eventId, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Post(':eventId/event-day/tasks/:taskId/reassignments')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  requestTaskReassignment(
    @Param('eventId') eventId: string,
    @Param('taskId') taskId: string,
    @Body(zodBody(createEventTaskReassignmentSchema)) dto: CreateEventTaskReassignmentInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.commandService.requestTaskReassignment(eventId, taskId, dto, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Patch(':eventId/event-day/task-reassignments/:requestId')
  @UseGuards(EventSessionGuard)
  decideTaskReassignment(
    @Param('eventId') eventId: string,
    @Param('requestId') requestId: string,
    @Body(zodBody(decideEventTaskReassignmentSchema)) dto: DecideEventTaskReassignmentInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.commandService.decideTaskReassignment(eventId, requestId, dto, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Post(':eventId/coordinators/:assignmentId/replace')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  replaceCoordinatorAssignment(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
    @Body(zodBody(replaceCoordinatorAssignmentSchema)) dto: ReplaceCoordinatorAssignmentInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.commandService.replaceCoordinatorAssignment(eventId, assignmentId, dto, actor);
  }

  @Patch(':eventId/supplier-status/:requestId/verify')
  @UseGuards(EventSessionGuard)
  verifySupplierStatus(
    @Param('eventId') eventId: string,
    @Param('requestId') requestId: string,
    @Body(zodBody(verifySupplierStatusSchema)) dto: VerifySupplierStatusInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.commandService.verifySupplierEventStatus(eventId, requestId, dto, actor);
  }
}
