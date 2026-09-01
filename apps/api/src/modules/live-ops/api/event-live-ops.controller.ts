import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { zodBody } from '@prism/kernel/shared';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import {
  createEventDayTaskSchema,
  createUrgentIssueSchema,
  escalateLiveOpsRecordSchema,
  replaceCoordinatorAssignmentSchema,
  updateCoordinatorAttendanceSchema,
  updateEventDayTaskSchema,
  updateUrgentIssueSchema,
  verifySupplierStatusSchema,
  type CreateEventDayTaskInput,
  type CreateUrgentIssueInput,
  type EscalateLiveOpsInput,
  type ReplaceCoordinatorAssignmentInput,
  type UpdateCoordinatorAttendanceInput,
  type UpdateEventDayTaskInput,
  type UpdateUrgentIssueInput,
  type VerifySupplierStatusInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { EventLiveOpsCommandService } from '../application/event-live-ops-command.service';
import { EventLiveOpsReadService } from '../application/event-live-ops-read.service';

@Controller('events')
export class EventLiveOpsController {
  constructor(
    private readonly readService: EventLiveOpsReadService,
    private readonly commandService: EventLiveOpsCommandService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

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
    @Body(zodBody(escalateLiveOpsRecordSchema)) dto: EscalateLiveOpsInput,
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
