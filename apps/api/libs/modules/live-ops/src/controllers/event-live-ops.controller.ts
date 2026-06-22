import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CreateEventDayTaskDto,
  CreateUrgentIssueDto,
  EscalateLiveOpsRecordDto,
  LiveOpsActorDto,
  ReplaceCoordinatorAssignmentDto,
  UpdateCoordinatorAttendanceDto,
  UpdateEventDayTaskDto,
  UpdateUrgentIssueDto,
  VerifySupplierStatusDto,
} from '../dto/live-ops.dto';
import { EventLiveOpsCommandService } from '../services/event-live-ops-command.service';
import { EventLiveOpsReadService } from '../services/event-live-ops-read.service';

@Controller('events')
export class EventLiveOpsController {
  constructor(
    private readonly readService: EventLiveOpsReadService,
    private readonly commandService: EventLiveOpsCommandService,
  ) {}

  @Get(':eventId/live-ops')
  liveOps(@Param('eventId') eventId: string, @Query() actor: LiveOpsActorDto) {
    return this.readService.getEventLiveOps(eventId, actor);
  }

  @Get(':eventId/event-day/status-feed')
  statusFeed(@Param('eventId') eventId: string, @Query() actor: LiveOpsActorDto) {
    return this.readService.getEventDayStatusFeed(eventId, actor);
  }

  @Post(':eventId/event-day/tasks')
  @HttpCode(HttpStatus.CREATED)
  createEventDayTask(
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventDayTaskDto,
    @Query() actor: LiveOpsActorDto,
  ) {
    return this.commandService.createEventDayTask(eventId, dto, actor);
  }

  @Patch(':eventId/event-day/tasks/:taskId')
  updateEventDayTask(
    @Param('eventId') eventId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateEventDayTaskDto,
    @Query() actor: LiveOpsActorDto,
  ) {
    return this.commandService.updateEventDayTask(eventId, taskId, dto, actor);
  }

  @Post(':eventId/event-day/tasks/:taskId/escalate')
  @HttpCode(HttpStatus.OK)
  escalateEventDayTask(
    @Param('eventId') eventId: string,
    @Param('taskId') taskId: string,
    @Body() dto: EscalateLiveOpsRecordDto,
    @Query() actor: LiveOpsActorDto,
  ) {
    return this.commandService.escalateEventDayTask(eventId, taskId, dto, actor);
  }

  @Post(':eventId/urgent-issues')
  @HttpCode(HttpStatus.CREATED)
  createUrgentIssue(
    @Param('eventId') eventId: string,
    @Body() dto: CreateUrgentIssueDto,
    @Query() actor: LiveOpsActorDto,
  ) {
    return this.commandService.createUrgentIssue(eventId, dto, actor);
  }

  @Patch(':eventId/urgent-issues/:issueId')
  updateUrgentIssue(
    @Param('eventId') eventId: string,
    @Param('issueId') issueId: string,
    @Body() dto: UpdateUrgentIssueDto,
    @Query() actor: LiveOpsActorDto,
  ) {
    return this.commandService.updateUrgentIssue(eventId, issueId, dto, actor);
  }

  @Post(':eventId/urgent-issues/:issueId/escalate')
  @HttpCode(HttpStatus.OK)
  escalateUrgentIssue(
    @Param('eventId') eventId: string,
    @Param('issueId') issueId: string,
    @Body() dto: EscalateLiveOpsRecordDto,
    @Query() actor: LiveOpsActorDto,
  ) {
    return this.commandService.escalateUrgentIssue(eventId, issueId, dto, actor);
  }

  @Patch(':eventId/coordinators/:assignmentId/status')
  updateCoordinatorAttendance(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateCoordinatorAttendanceDto,
    @Query() actor: LiveOpsActorDto,
  ) {
    return this.commandService.updateCoordinatorAttendance(eventId, assignmentId, dto, actor);
  }

  @Post(':eventId/coordinators/:assignmentId/replace')
  @HttpCode(HttpStatus.OK)
  replaceCoordinatorAssignment(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: ReplaceCoordinatorAssignmentDto,
    @Query() actor: LiveOpsActorDto,
  ) {
    return this.commandService.replaceCoordinatorAssignment(eventId, assignmentId, dto, actor);
  }

  @Patch(':eventId/supplier-status/:requestId/verify')
  verifySupplierStatus(
    @Param('eventId') eventId: string,
    @Param('requestId') requestId: string,
    @Body() dto: VerifySupplierStatusDto,
    @Query() actor: LiveOpsActorDto,
  ) {
    return this.commandService.verifySupplierEventStatus(eventId, requestId, dto, actor);
  }
}