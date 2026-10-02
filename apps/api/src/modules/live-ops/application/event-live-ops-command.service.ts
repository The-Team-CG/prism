import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { canonicalCoordinatorRole } from '@prism/types';
import {
  EventAccessPolicyService,
  type ResolvedEventOpsActor,
} from '@prism/kernel/access-control';
import type {
  CreateEventDayTaskInput,
  CreateEventTaskReassignmentInput,
  DecideEventTaskReassignmentInput,
  CreateUrgentIssueInput,
  EscalateLiveOpsInput,
  EscalateEventDayTaskInput,
  ReplaceCoordinatorAssignmentInput,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  UpdateSupplierEventStatusInput,
  UpdateUrgentIssueInput,
  VerifySupplierStatusInput,
} from '@prism/types';
import { OpsUserRole } from '@prism/kernel/event-core';
import { STAFFING_READER, type StaffingReader } from '@prism/contexts/operations';
import {
  mapSupplierQuoteRequest,
  SUPPLIER_COMMANDS,
  type SupplierCommands,
} from '@prism/contexts/commercial';
import {
  mapCoordinatorAssignmentForEventDay,
  mapEventDayTask,
  mapUrgentIssue,
} from './live-ops.mappers';
import { computeSlaStatus } from '../domain/live-ops-sla.policy';
import { recordEventDayLog } from './event-day-log.writer';
import { CoordinatorLiveOpsCommandService } from './coordinator-live-ops-command.service';
import { LiveOpsTaskIssueCommandService } from './live-ops-task-issue-command.service';

@Injectable()
export class EventLiveOpsCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly taskIssueCommandService: LiveOpsTaskIssueCommandService,
    private readonly coordinatorCommandService: CoordinatorLiveOpsCommandService,
    @Inject(STAFFING_READER) private readonly staffingReader: StaffingReader,
    @Inject(SUPPLIER_COMMANDS) private readonly supplierCommands: SupplierCommands,
  ) {}

  async createEventDayTask(eventId: string, input: CreateEventDayTaskInput, actor: ResolvedEventOpsActor) {
    const { assignment, designatedOperator } = await this.requireEventDayWriteActor(eventId, actor, 'event-day tasks');
    this.requireCoordinatorTaskScope(actor, assignment, designatedOperator, input.assignedRole, input.ownerName);
    const task = await this.taskIssueCommandService.createEventDayTask(eventId, input, actor);
    return mapEventDayTask(task, computeSlaStatus);
  }

  async updateEventDayTask(
    eventId: string,
    taskId: string,
    input: UpdateEventDayTaskInput,
    actor: ResolvedEventOpsActor,
  ) {
    const { assignment, designatedOperator } = await this.requireEventDayWriteActor(eventId, actor, 'event-day tasks');
    if (actor.role === OpsUserRole.Coordinator && Object.keys(input).some((key) => key !== 'status')) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'coordinator task ownership update', eventId);
      throw new ForbiddenException('Coordinators may only update task status; request PMCM review to change task ownership');
    }
    await this.requireTaskScope(eventId, taskId, actor, assignment, designatedOperator);
    const task = await this.taskIssueCommandService.updateEventDayTask(eventId, taskId, input, actor);
    return mapEventDayTask(task, computeSlaStatus);
  }

  async escalateEventDayTask(
    eventId: string,
    taskId: string,
    input: EscalateEventDayTaskInput,
    actor: ResolvedEventOpsActor,
  ) {
    const { assignment, designatedOperator } = await this.requireEventDayWriteActor(eventId, actor, 'event-day task escalation');
    await this.requireTaskScope(eventId, taskId, actor, assignment, designatedOperator);
    const task = await this.taskIssueCommandService.escalateEventDayTask(eventId, taskId, input, actor);
    return mapEventDayTask(task, computeSlaStatus);
  }

  async createUrgentIssue(eventId: string, input: CreateUrgentIssueInput, actor: ResolvedEventOpsActor) {
    const { assignment, designatedOperator } = await this.requireEventDayWriteActor(eventId, actor, 'urgent issues');
    const scopedInput = await this.scopeCoordinatorIssueInput(eventId, actor, assignment, designatedOperator, input);
    const issue = await this.taskIssueCommandService.createUrgentIssue(eventId, scopedInput, actor);
    return mapUrgentIssue(issue, computeSlaStatus);
  }

  async updateUrgentIssue(
    eventId: string,
    issueId: string,
    input: UpdateUrgentIssueInput,
    actor: ResolvedEventOpsActor,
  ) {
    const { assignment, designatedOperator } = await this.requireEventDayWriteActor(eventId, actor, 'urgent issues');
    await this.requireUrgentIssueScope(eventId, issueId, actor, assignment, designatedOperator);
    await this.rejectCoordinatorIssueOwnershipChange(eventId, actor, designatedOperator, input.ownerRole, input.ownerName);
    const issue = await this.taskIssueCommandService.updateUrgentIssue(eventId, issueId, input, actor);
    return mapUrgentIssue(issue, computeSlaStatus);
  }

  async escalateUrgentIssue(
    eventId: string,
    issueId: string,
    input: EscalateLiveOpsInput,
    actor: ResolvedEventOpsActor,
  ) {
    const { assignment, designatedOperator } = await this.requireEventDayWriteActor(eventId, actor, 'urgent issue escalation');
    await this.requireUrgentIssueScope(eventId, issueId, actor, assignment, designatedOperator);
    await this.rejectCoordinatorIssueOwnershipChange(eventId, actor, designatedOperator, input.ownerRole, input.ownerName);
    const issue = await this.taskIssueCommandService.escalateUrgentIssue(eventId, issueId, input, actor);
    return mapUrgentIssue(issue, computeSlaStatus);
  }

  async updateCoordinatorAttendance(
    eventId: string,
    assignmentId: string,
    input: UpdateCoordinatorAttendanceInput,
    actor: ResolvedEventOpsActor,
  ) {
    // PA-298: updateCoordinatorAttendance previously discarded requireEventDayWriteActor's
    // resolved assignment, letting any Coordinator assigned to the event mark any other
    // coordinator's attendance by changing the assignmentId path segment.
    const { assignment: actorAssignment, designatedOperator } = await this.requireEventDayWriteActor(
      eventId,
      actor,
      'coordinator attendance',
    );
    if (actor.role === OpsUserRole.Coordinator && !designatedOperator && actorAssignment?.id !== assignmentId) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'coordinator attendance', eventId);
      throw new ForbiddenException("Coordinator cannot mark another coordinator's attendance");
    }
    const assignment = await this.coordinatorCommandService.updateCoordinatorAttendance(eventId, assignmentId, input, actor);
    return mapCoordinatorAssignmentForEventDay(
      assignment,
      this.staffingReader.mapCoordinatorAssignment.bind(this.staffingReader),
    );
  }

  async requestTaskReassignment(eventId: string, taskId: string, input: CreateEventTaskReassignmentInput, actor: ResolvedEventOpsActor) {
    const { assignment, designatedOperator } = await this.requireEventDayWriteActor(eventId, actor, 'task reassignment');
    if (actor.role === OpsUserRole.Coordinator && !designatedOperator) {
      throw new ForbiddenException('Only the designated Event Day System Operator may request task reassignment');
    }
    return this.taskIssueCommandService.requestTaskReassignment(eventId, taskId, input, actor);
  }

  async listTaskReassignmentRequests(eventId: string, actor: ResolvedEventOpsActor) {
    const { designatedOperator } = await this.requireEventDayActor(eventId, actor, 'task reassignment requests');
    if (actor.role === OpsUserRole.Coordinator && !designatedOperator) {
      throw new ForbiddenException('Only the designated Event Day System Operator may view task reassignment requests');
    }
    return this.taskIssueCommandService.listTaskReassignmentRequests(eventId);
  }

  async decideTaskReassignment(eventId: string, requestId: string, input: DecideEventTaskReassignmentInput, actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'task reassignment decision', eventId);
    return this.taskIssueCommandService.decideTaskReassignment(eventId, requestId, input, actor);
  }

  async replaceCoordinatorAssignment(
    eventId: string,
    assignmentId: string,
    input: ReplaceCoordinatorAssignmentInput,
    actor: ResolvedEventOpsActor,
  ) {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'coordinator replacement',
      eventId,
    );
    const { replacedAssignment, replacementAssignment } =
      await this.coordinatorCommandService.replaceCoordinatorAssignment(eventId, assignmentId, input, actor);

    return {
      replacedAssignment: mapCoordinatorAssignmentForEventDay(
        replacedAssignment,
        this.staffingReader.mapCoordinatorAssignment.bind(this.staffingReader),
      ),
      replacementAssignment: mapCoordinatorAssignmentForEventDay(
        replacementAssignment,
        this.staffingReader.mapCoordinatorAssignment.bind(this.staffingReader),
      ),
    };
  }

  async verifySupplierEventStatus(
    eventId: string,
    requestId: string,
    input: VerifySupplierStatusInput,
    actor: ResolvedEventOpsActor,
  ) {
    const { assignment, designatedOperator } = await this.requireEventDayWriteActor(eventId, actor, 'supplier setup verification');
    if (actor.role === OpsUserRole.Coordinator && !designatedOperator && !this.isIngressRole(assignment?.role)) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'supplier setup verification', eventId);
      throw new ForbiddenException('Only the ingress coordinator or designated operator may verify supplier setup');
    }
    const updated = await this.supplierCommands.verifySupplierEventStatus(eventId, requestId, input, actor);
    const verifiedBy = actor.name;
    const metadata = { verificationStatus: input.verificationStatus, verifiedBy, notes: input.notes ?? '' };
    await recordEventDayLog(this.prisma,
      eventId,
      'supplier_status_verified',
      actor,
      `Marked supplier setup ${input.verificationStatus}: ${updated.supplierName}`,
      'supplier_quote_request',
      updated.id,
      metadata,
    );

    return mapSupplierQuoteRequest(updated);
  }

  async updateSupplierEventStatus(
    requestId: string,
    input: UpdateSupplierEventStatusInput,
    actor: ResolvedEventOpsActor,
  ) {
    const request = await this.supplierCommands.updateSupplierEventStatus(requestId, input, actor);
    await recordEventDayLog(this.prisma,
      request.eventId,
      'supplier_status_updated',
      actor,
      `Supplier status update: ${input.status}`,
      'supplier_quote_request',
      request.id,
      { status: input.status, notes: input.notes ?? '', photoFileName: input.photo?.fileName ?? null },
    );

    return mapSupplierQuoteRequest(request);
  }

  private async requireEventDayWriteActor(eventId: string, actor: ResolvedEventOpsActor, resource: string) {
    const scope = await this.requireEventDayActor(eventId, actor, resource);
    if (actor.role === OpsUserRole.Coordinator && scope.event.archived) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'archived coordinator event write', eventId);
      throw new ForbiddenException('Archived coordinator events are read-only');
    }
    return scope;
  }

  private async requireEventDayActor(eventId: string, actor: ResolvedEventOpsActor, resource: string) {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      resource,
      eventId,
    );
    const event = await this.requireEvent(eventId);
    const assignment =
      actor.role === OpsUserRole.Coordinator
        ? await this.requireCoordinatorAssignmentForEvent(eventId, actor)
        : null;
    const designationModel = this.prisma.opsEventOperatorDesignation;
    const designatedOperator = actor.role === OpsUserRole.Coordinator && Boolean(
      assignment?.coordinatorId && await designationModel.findFirst({
        where: { eventId, coordinatorId: assignment.coordinatorId, revokedAt: null },
      }),
    );
    return { actor, assignment, designatedOperator, event };
  }

  private async requireEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async requireCoordinatorAssignmentForEvent(eventId: string, actor: ResolvedEventOpsActor) {
    const assignment = await this.staffingReader.findAssignmentForEventActor(eventId, actor);
    if (!assignment) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'assigned event-day operations', eventId);
      throw new ForbiddenException('Coordinator is not assigned to this event');
    }
    return assignment;
  }

  private isIngressRole(role?: string | null) {
    const value = role?.toLowerCase() ?? '';
    return value.includes('ingress') || value.includes('egress');
  }

  private requireCoordinatorTaskScope(
    actor: ResolvedEventOpsActor,
    assignment: Awaited<ReturnType<EventLiveOpsCommandService['requireCoordinatorAssignmentForEvent']>> | null,
    designatedOperator: boolean,
    assignedRole?: string,
    ownerName?: string,
  ) {
    if (actor.role !== OpsUserRole.Coordinator || designatedOperator || !assignment) return;
    const role = assignedRole?.trim();
    const owner = ownerName?.trim();
    const requestedRole = canonicalCoordinatorRole(role);
    const ownRole = canonicalCoordinatorRole(assignment.role);
    const ownerMatches = Boolean(owner) && this.eventAccessPolicyService.sameText(owner, assignment.coordinatorName);
    const isLegacyOwnQueueFallback =
      !ownRole && requestedRole === 'General Coordinator' && ownerMatches;
    this.requireTaskRole(role, requestedRole, ownRole, isLegacyOwnQueueFallback);
    this.requireTaskOwner(ownRole, isLegacyOwnQueueFallback, owner, ownerMatches);
  }

  private requireTaskOwner(
    ownRole: ReturnType<typeof canonicalCoordinatorRole>,
    isLegacyOwnQueueFallback: boolean,
    owner: string | undefined,
    ownerMatches: boolean,
  ) {
    if (!ownRole && !isLegacyOwnQueueFallback) {
      throw new ForbiddenException('Coordinator may only create tasks for their own queue');
    }
    if (owner && !ownerMatches) {
      throw new ForbiddenException('Coordinator may only create tasks for their own queue');
    }
  }

  private requireTaskRole(
    role: string | undefined,
    requestedRole: ReturnType<typeof canonicalCoordinatorRole>,
    ownRole: ReturnType<typeof canonicalCoordinatorRole>,
    isLegacyOwnQueueFallback: boolean,
  ) {
    if (!role) return;
    if (!requestedRole || (requestedRole !== ownRole && !isLegacyOwnQueueFallback)) {
      throw new ForbiddenException('Coordinator may only create tasks for their role');
    }
  }

  private async scopeCoordinatorIssueInput(
    eventId: string,
    actor: ResolvedEventOpsActor,
    assignment: Awaited<ReturnType<EventLiveOpsCommandService['requireCoordinatorAssignmentForEvent']>> | null,
    designatedOperator: boolean,
    input: CreateUrgentIssueInput,
  ): Promise<CreateUrgentIssueInput> {
    if (actor.role !== OpsUserRole.Coordinator || designatedOperator || !assignment) return input;
    const role = input.ownerRole?.trim();
    const owner = input.ownerName?.trim();
    const canonicalRole = canonicalCoordinatorRole(assignment.role);
    const requestedRole = canonicalCoordinatorRole(role);
    if ((role && (!requestedRole || requestedRole !== canonicalRole)) ||
      (owner && !this.eventAccessPolicyService.sameText(owner, assignment.coordinatorName))) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'coordinator urgent issue ownership', eventId);
      throw new ForbiddenException('Coordinator may only create issues for their own role and queue');
    }
    const scopedInput = { ...input, ownerName: assignment.coordinatorName };
    if (canonicalRole) scopedInput.ownerRole = canonicalRole;
    else delete scopedInput.ownerRole;
    return scopedInput;
  }

  private async requireUrgentIssueScope(
    eventId: string,
    issueId: string,
    actor: ResolvedEventOpsActor,
    assignment: Awaited<ReturnType<EventLiveOpsCommandService['requireCoordinatorAssignmentForEvent']>> | null,
    designatedOperator: boolean,
  ) {
    if (actor.role !== OpsUserRole.Coordinator || designatedOperator) return;
    const issue = await this.prisma.opsUrgentIssue.findFirst({
      where: { id: issueId, eventId },
      select: { ownerRole: true, ownerName: true },
    });
    if (!issue) throw new NotFoundException('Urgent issue not found');
    const roleMatches = Boolean(issue.ownerRole?.trim()) && this.eventAccessPolicyService.sameText(issue.ownerRole, assignment?.role);
    const ownerMatches = Boolean(issue.ownerName?.trim()) && this.eventAccessPolicyService.sameText(issue.ownerName, assignment?.coordinatorName);
    if (!assignment || (!roleMatches && !ownerMatches)) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'coordinator urgent issue scope', eventId);
      throw new ForbiddenException('Coordinator may only update issues in their own role or queue');
    }
  }

  private async rejectCoordinatorIssueOwnershipChange(
    eventId: string,
    actor: ResolvedEventOpsActor,
    designatedOperator: boolean,
    ownerRole?: string,
    ownerName?: string,
  ) {
    if (actor.role !== OpsUserRole.Coordinator || designatedOperator || (ownerRole === undefined && ownerName === undefined)) return;
    await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'coordinator urgent issue ownership update', eventId);
    throw new ForbiddenException('Coordinators cannot change urgent issue ownership directly');
  }

  private async requireTaskScope(
    eventId: string,
    taskId: string,
    actor: ResolvedEventOpsActor,
    assignment: Awaited<ReturnType<EventLiveOpsCommandService['requireCoordinatorAssignmentForEvent']>> | null,
    designatedOperator: boolean,
  ) {
    if (actor.role !== OpsUserRole.Coordinator || designatedOperator) return;
    const task = await this.prisma.opsEventDayTask.findFirst({ where: { id: taskId, eventId } });
    if (!task) throw new NotFoundException('Event-day task not found');
    if (!assignment || !this.taskBelongsToAssignment(task, assignment)) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'coordinator task scope', eventId);
      throw new ForbiddenException('Coordinator may only update tasks in their own queue');
    }
  }

  private taskBelongsToAssignment(
    task: { assignedRole: string; ownerName: string | null },
    assignment: NonNullable<Awaited<ReturnType<EventLiveOpsCommandService['requireCoordinatorAssignmentForEvent']>>>,
  ) {
    const taskRole = canonicalCoordinatorRole(task.assignedRole);
    const assignmentRole = canonicalCoordinatorRole(assignment?.role);
    const roleMatches = taskRole && assignmentRole
      ? taskRole === assignmentRole
      : this.eventAccessPolicyService.sameText(task.assignedRole, assignment?.role);
    const ownerMatches = !task.ownerName || this.eventAccessPolicyService.sameText(task.ownerName, assignment?.coordinatorName);
    const ownerIsActor = Boolean(task.ownerName) &&
      this.eventAccessPolicyService.sameText(task.ownerName, assignment?.coordinatorName);
    const isLegacyOwnQueueFallback =
      !assignmentRole && taskRole === 'General Coordinator' && ownerIsActor;
    return Boolean((roleMatches || isLegacyOwnQueueFallback) && ownerMatches);
  }

}
