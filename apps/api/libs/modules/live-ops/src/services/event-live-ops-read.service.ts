import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsEvent, OpsFloorPlanDraft, OpsSupplierQuoteRequest } from '@prisma/client';
import { PrismaService } from '@prism/database';
import type { PrismVerifiedEventActor } from '@prism/types';
import {
  EventAccessPolicyService,
  type ResolvedEventOpsActor,
} from '@prism/modules/access-control';
import {
  isOpsConstantValue,
  OpsUserRole,
  SupplierQuoteRequestStatus,
  SupplierVerificationStatus,
} from '@prism/modules/event-core';
import { FloorPlanWorkflowService } from '@prism/modules/floorplan';
import { GuestWorkflowService } from '@prism/modules/guest-ops';
import { CoordinatorsService } from '@prism/modules/staffing-ops';
import { mapSupplierQuoteRequest } from '@prism/modules/supplier-ops';
import { LiveOpsActorDto } from '../dto/live-ops.dto';
import {
  mapCoordinatorAssignmentForEventDay,
  mapEventDayLog,
  mapEventDayTask,
  mapUrgentIssue,
} from '../mappers/live-ops.mappers';
import { LiveOperationsService } from './live-operations.service';

type EventWithDrafts = OpsEvent & { floorPlanDrafts?: OpsFloorPlanDraft[] };

function timestamp(value: Date) {
  return value.toISOString();
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class EventLiveOpsReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly liveOperationsService: LiveOperationsService,
    private readonly coordinatorsService: CoordinatorsService,
    private readonly guestWorkflowService: GuestWorkflowService,
    private readonly floorPlanWorkflowService: FloorPlanWorkflowService,
  ) {}

  async getEventLiveOps(eventId: string, actorInput: LiveOpsActorDto = {}, verifiedActor?: PrismVerifiedEventActor): Promise<unknown> {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      'event-day live operations',
      eventId,
    );

    const event = await this.requireEvent(eventId);
    let coordinatorAssignment: any | null = null;
    if (actor.role === OpsUserRole.Coordinator) {
      coordinatorAssignment = await this.requireCoordinatorAssignmentForEvent(eventId, actor);
    }

    const [tasks, urgentIssues, supplierRequests, coordinatorAssignments, guestCheckIns, eventDayLogs] =
      await Promise.all([
        this.prisma.opsEventDayTask.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.opsUrgentIssue.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
        this.prisma.opsSupplierQuoteRequest.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } }),
        this.coordinatorsService.listAssignmentsForEvent(eventId),
        this.guestWorkflowService.listCheckInsForEvent(eventId),
        this.prisma.opsEventDayLog.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      ]);

    const roleScopedTasks = coordinatorAssignment
      ? tasks.filter(
          (task: any) =>
            this.eventAccessPolicyService.sameText(task.assignedRole, coordinatorAssignment.role) ||
            this.eventAccessPolicyService.sameText(task.ownerName, coordinatorAssignment.coordinatorName) ||
            this.eventAccessPolicyService.sameText(task.assignedRole, 'General Coordinator'),
        )
      : tasks;
    const roleScopedIssues = coordinatorAssignment
      ? urgentIssues.filter(
          (issue: any) =>
            !issue.ownerRole ||
            this.eventAccessPolicyService.sameText(issue.ownerRole, coordinatorAssignment.role) ||
            this.eventAccessPolicyService.sameText(issue.ownerName, coordinatorAssignment.coordinatorName),
        )
      : urgentIssues;
    const mappedSupplierStatuses = supplierRequests.map((request: OpsSupplierQuoteRequest) => ({
      ...mapSupplierQuoteRequest(this.withExpiredQuoteRequestStatus(request)),
      verificationStatus: request.eventDayVerificationStatus ?? SupplierVerificationStatus.SelfReported,
      verifiedAt: request.eventDayVerifiedAt ? timestamp(request.eventDayVerifiedAt) : null,
      verifiedBy: request.eventDayVerifiedBy ?? null,
      verificationNotes: request.eventDayVerificationNotes ?? '',
    }));

    const base = {
      event: this.mapEvent(event),
      tasks: roleScopedTasks.map((task: any) =>
        mapEventDayTask(task, this.liveOperationsService.computeSlaStatus.bind(this.liveOperationsService)),
      ),
      urgentIssues: roleScopedIssues.map((issue: any) =>
        mapUrgentIssue(issue, this.liveOperationsService.computeSlaStatus.bind(this.liveOperationsService)),
      ),
      supplierStatuses: mappedSupplierStatuses,
      coordinatorAssignments: (coordinatorAssignment ? [coordinatorAssignment] : coordinatorAssignments).map(
        (assignment: any) =>
          mapCoordinatorAssignmentForEventDay(
            assignment,
            this.coordinatorsService.mapCoordinatorAssignment.bind(this.coordinatorsService),
          ),
      ),
      guestAttendanceCount: guestCheckIns.length,
      guestCheckIns: guestCheckIns.map((checkIn: any) => this.guestWorkflowService.mapGuestCheckIn(checkIn)),
      eventDayLogs: eventDayLogs.map((log: any) => mapEventDayLog(log)),
    };

    if (actor.role === OpsUserRole.Coordinator) {
      return {
        ...base,
        role: coordinatorAssignment.role,
        supplierStatuses: mappedSupplierStatuses.map((status) => ({
          id: status.id,
          eventId: status.eventId,
          supplierId: status.supplierId,
          supplierName: status.supplierName,
          category: status.category,
          assignmentStatus: status.assignmentStatus,
          readinessStatus: status.readinessStatus,
          eventDayStatus: status.eventDayStatus,
          eventDayNotes: status.eventDayNotes,
          verificationStatus: status.verificationStatus,
          verifiedAt: status.verifiedAt,
          verifiedBy: status.verifiedBy,
        })),
        guestCheckIns: this.isRegistrationRole(coordinatorAssignment.role) ? base.guestCheckIns : [],
      };
    }

    return base;
  }

  async getEventDayStatusFeed(eventId: string, actorInput: LiveOpsActorDto = {}, verifiedActor?: PrismVerifiedEventActor): Promise<unknown> {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      'event-day status feed',
      eventId,
    );
    const liveOps = (await this.getEventLiveOps(eventId, actorInput, verifiedActor)) as any;
    const role = 'role' in liveOps ? liveOps.role : undefined;
    const includeGuestDetails =
      actor.role === OpsUserRole.PmcmAdmin ||
      actor.role === OpsUserRole.System ||
      Boolean(role && this.isRegistrationRole(role));

    return this.liveOperationsService.buildStatusFeed({
      event: liveOps.event,
      role,
      tasks: liveOps.tasks,
      urgentIssues: liveOps.urgentIssues,
      supplierStatuses: liveOps.supplierStatuses,
      coordinatorAssignments: liveOps.coordinatorAssignments,
      eventDayLogs: liveOps.eventDayLogs,
      guestAttendanceCount: liveOps.guestAttendanceCount,
      guestCheckIns: liveOps.guestCheckIns,
      includeGuestDetails,
    });
  }

  async getCoordinatorRoleView(eventId: string, actorInput: LiveOpsActorDto = {}, verifiedActor?: PrismVerifiedEventActor): Promise<unknown> {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Coordinator], 'coordinator role view', eventId);
    const assignment = await this.requireCoordinatorAssignmentForEvent(eventId, actor);
    const liveOps = (await this.getEventLiveOps(eventId, actorInput, verifiedActor)) as any;

    return {
      event: liveOps.event,
      assignment: mapCoordinatorAssignmentForEventDay(
        assignment,
        this.coordinatorsService.mapCoordinatorAssignment.bind(this.coordinatorsService),
      ),
      role: assignment.role,
      tasks: liveOps.tasks,
      urgentIssues: liveOps.urgentIssues,
      supplierStatuses: liveOps.supplierStatuses,
      guestAttendanceCount: liveOps.guestAttendanceCount,
      guestCheckIns: this.isRegistrationRole(assignment.role) ? liveOps.guestCheckIns : [],
    };
  }

  private async requireEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({
      where: { id: eventId },
      include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event as EventWithDrafts;
  }

  private async requireCoordinatorAssignmentForEvent(eventId: string, actor: ResolvedEventOpsActor) {
    const assignment = await this.coordinatorsService.findAssignmentForEventActor(eventId, actor);
    if (!assignment) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'assigned event-day operations', eventId);
      throw new ForbiddenException('Coordinator is not assigned to this event');
    }
    return assignment;
  }

  private isRegistrationRole(role: string) {
    const normalized = role.toLowerCase();
    return normalized.includes('registration') || normalized.includes('usher');
  }

  private withExpiredQuoteRequestStatus(request: OpsSupplierQuoteRequest) {
    if (
      request.dueDate &&
      request.dueDate.getTime() < Date.now() &&
      isOpsConstantValue(SupplierQuoteRequestStatus, request.status) &&
      (request.status === SupplierQuoteRequestStatus.Open ||
        request.status === SupplierQuoteRequestStatus.RevisionRequested)
    ) {
      return { ...request, status: SupplierQuoteRequestStatus.Expired } as OpsSupplierQuoteRequest;
    }
    return request;
  }

  private mapEvent(event: EventWithDrafts) {
    const floorPlanDrafts = event.floorPlanDrafts ?? [];
    const activeDraft =
      floorPlanDrafts.find((draft) => draft.isActive) ??
      floorPlanDrafts.find((draft) => draft.floorPlanId === event.floorPlanId);

    return {
      id: event.id,
      inquiryId: event.inquiryId,
      clientName: event.clientName,
      eventName: event.eventName,
      eventDate: isoDate(event.eventDate),
      status: event.status,
      clientPortalStatus: event.clientPortalStatus as 'locked' | 'unlocked',
      readiness: event.readiness,
      archived: event.archived,
      floorPlanStatus: event.floorPlanStatus,
      floorPlanId: event.floorPlanId,
      guestAccessCode: this.guestWorkflowService.guestAccessCode(event),
      activeFloorPlanDraftId: activeDraft?.id,
      floorPlanDrafts: floorPlanDrafts.map((draft) => this.floorPlanWorkflowService.mapFloorPlanDraft(draft)),
    };
  }
}