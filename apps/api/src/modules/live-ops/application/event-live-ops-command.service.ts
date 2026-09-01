import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import {
  EventAccessPolicyService,
  type ResolvedEventOpsActor,
} from '@prism/kernel/access-control';
import type {
  CreateEventDayTaskInput,
  CreateUrgentIssueInput,
  EscalateLiveOpsInput,
  ReplaceCoordinatorAssignmentInput,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  UpdateSupplierEventStatusInput,
  UpdateUrgentIssueInput,
  VerifySupplierStatusInput,
} from '@prism/types';
import { OpsUserRole } from '@prism/kernel/event-core';
import { CoordinatorsService } from '@prism/contexts/operations';
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
import { LiveOperationsService } from './live-operations.service';

@Injectable()
export class EventLiveOpsCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly liveOperationsService: LiveOperationsService,
    private readonly coordinatorsService: CoordinatorsService,
    @Inject(SUPPLIER_COMMANDS) private readonly supplierCommands: SupplierCommands,
  ) {}

  async createEventDayTask(eventId: string, input: CreateEventDayTaskInput, actor: ResolvedEventOpsActor) {
    await this.requireEventDayWriteActor(eventId, actor, 'event-day tasks');
    const task = await this.liveOperationsService.createEventDayTask(eventId, input, actor);
    return mapEventDayTask(task, this.liveOperationsService.computeSlaStatus.bind(this.liveOperationsService));
  }

  async updateEventDayTask(
    eventId: string,
    taskId: string,
    input: UpdateEventDayTaskInput,
    actor: ResolvedEventOpsActor,
  ) {
    await this.requireEventDayWriteActor(eventId, actor, 'event-day tasks');
    const task = await this.liveOperationsService.updateEventDayTask(eventId, taskId, input, actor);
    return mapEventDayTask(task, this.liveOperationsService.computeSlaStatus.bind(this.liveOperationsService));
  }

  async escalateEventDayTask(
    eventId: string,
    taskId: string,
    input: EscalateLiveOpsInput,
    actor: ResolvedEventOpsActor,
  ) {
    await this.requireEventDayWriteActor(eventId, actor, 'event-day task escalation');
    const task = await this.liveOperationsService.escalateEventDayTask(eventId, taskId, input, actor);
    return mapEventDayTask(task, this.liveOperationsService.computeSlaStatus.bind(this.liveOperationsService));
  }

  async createUrgentIssue(eventId: string, input: CreateUrgentIssueInput, actor: ResolvedEventOpsActor) {
    await this.requireEventDayWriteActor(eventId, actor, 'urgent issues');
    const issue = await this.liveOperationsService.createUrgentIssue(eventId, input, actor);
    return mapUrgentIssue(issue, this.liveOperationsService.computeSlaStatus.bind(this.liveOperationsService));
  }

  async updateUrgentIssue(
    eventId: string,
    issueId: string,
    input: UpdateUrgentIssueInput,
    actor: ResolvedEventOpsActor,
  ) {
    await this.requireEventDayWriteActor(eventId, actor, 'urgent issues');
    const issue = await this.liveOperationsService.updateUrgentIssue(eventId, issueId, input, actor);
    return mapUrgentIssue(issue, this.liveOperationsService.computeSlaStatus.bind(this.liveOperationsService));
  }

  async escalateUrgentIssue(
    eventId: string,
    issueId: string,
    input: EscalateLiveOpsInput,
    actor: ResolvedEventOpsActor,
  ) {
    await this.requireEventDayWriteActor(eventId, actor, 'urgent issue escalation');
    const issue = await this.liveOperationsService.escalateUrgentIssue(eventId, issueId, input, actor);
    return mapUrgentIssue(issue, this.liveOperationsService.computeSlaStatus.bind(this.liveOperationsService));
  }

  async updateCoordinatorAttendance(
    eventId: string,
    assignmentId: string,
    input: UpdateCoordinatorAttendanceInput,
    actor: ResolvedEventOpsActor,
  ) {
    await this.requireEventDayWriteActor(eventId, actor, 'coordinator attendance');
    const assignment = await this.liveOperationsService.updateCoordinatorAttendance(eventId, assignmentId, input, actor);
    return mapCoordinatorAssignmentForEventDay(
      assignment,
      this.coordinatorsService.mapCoordinatorAssignment.bind(this.coordinatorsService),
    );
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
      await this.liveOperationsService.replaceCoordinatorAssignment(eventId, assignmentId, input, actor);

    return {
      replacedAssignment: mapCoordinatorAssignmentForEventDay(
        replacedAssignment,
        this.coordinatorsService.mapCoordinatorAssignment.bind(this.coordinatorsService),
      ),
      replacementAssignment: mapCoordinatorAssignmentForEventDay(
        replacementAssignment,
        this.coordinatorsService.mapCoordinatorAssignment.bind(this.coordinatorsService),
      ),
    };
  }

  async verifySupplierEventStatus(
    eventId: string,
    requestId: string,
    input: VerifySupplierStatusInput,
    actor: ResolvedEventOpsActor,
  ) {
    await this.requireEventDayWriteActor(eventId, actor, 'supplier setup verification');
    const updated = await this.supplierCommands.verifySupplierEventStatus(eventId, requestId, input, actor);
    const verifiedBy = actor.name;
    const metadata = { verificationStatus: input.verificationStatus, verifiedBy, notes: input.notes ?? '' };
    await this.liveOperationsService.recordEventDayLog(
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
    await this.liveOperationsService.recordEventDayLog(
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
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      resource,
      eventId,
    );
    await this.requireEvent(eventId);
    const assignment =
      actor.role === OpsUserRole.Coordinator
        ? await this.requireCoordinatorAssignmentForEvent(eventId, actor)
        : null;
    return { actor, assignment };
  }

  private async requireEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async requireCoordinatorAssignmentForEvent(eventId: string, actor: ResolvedEventOpsActor) {
    const assignment = await this.coordinatorsService.findAssignmentForEventActor(eventId, actor);
    if (!assignment) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'assigned event-day operations', eventId);
      throw new ForbiddenException('Coordinator is not assigned to this event');
    }
    return assignment;
  }

}
