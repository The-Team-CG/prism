import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { zodBody } from '@prism/shared';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/event-session';
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
import {
  LiveOpsActorDto,
} from './live-ops.dto';
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
    @Query() _actorInput: LiveOpsActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.readService.getEventLiveOps(eventId, actor);
  }

  @Get(':eventId/event-day/status-feed')
  @UseGuards(EventSessionGuard)
  statusFeed(
    @Param('eventId') eventId: string,
    @Query() _actorInput: LiveOpsActorDto,
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
    @Query() _actorInput: LiveOpsActorDto,
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
    @Query() _actorInput: LiveOpsActorDto,
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
    @Query() _actorInput: LiveOpsActorDto,
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
    @Query() _actorInput: LiveOpsActorDto,
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
    @Query() _actorInput: LiveOpsActorDto,
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
    @Query() _actorInput: LiveOpsActorDto,
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
    @Query() _actorInput: LiveOpsActorDto,
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
    @Query() _actorInput: LiveOpsActorDto,
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
    @Query() _actorInput: LiveOpsActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.commandService.verifySupplierEventStatus(eventId, requestId, dto, actor);
  }
}
