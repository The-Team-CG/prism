import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsEvent, OpsFloorPlanDraft, OpsSupplierQuoteRequest } from '@prisma/client';
import type {
  PrismCoordinatorRoleView,
  PrismCoordinatorLiveOps,
  PrismEvent,
  PrismEventDayStatusFeed,
  PrismFloorPlanDraft,
  PrismLiveOps,
} from '@prism/types';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import {
  isOpsConstantValue,
  OpsUserRole,
  SupplierQuoteRequestStatus,
  SupplierVerificationStatus,
} from '@prism/kernel/event-core';
import { FLOORPLAN_READER, type FloorplanReader } from '@prism/contexts/floorplan';
import { GUEST_READER, type GuestReader, STAFFING_READER, type StaffingReader } from '@prism/contexts/operations';
import { mapSupplierQuoteRequest } from '@prism/contexts/commercial';
import { EventReadModelQueries } from '../queries/event-read-models.queries';
import {
  buildStatusFeed,
  mapCoordinatorAssignmentForEventDay,
  mapEventDayLog,
  mapEventDayTask,
  mapUrgentIssue,
} from '../mappers/live-ops-read-model.mappers';
import type { LiveOpsReadModel } from '../../contracts/ports/live-ops-read-model.port';

type EventWithDrafts = OpsEvent & { floorPlanDrafts?: OpsFloorPlanDraft[] };

@Injectable()
export class LiveOpsReadModelsService implements LiveOpsReadModel {
  constructor(
    private readonly queries: EventReadModelQueries,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(FLOORPLAN_READER) private readonly floorplanReader: FloorplanReader,
    @Inject(GUEST_READER) private readonly guestReader: GuestReader,
    @Inject(STAFFING_READER) private readonly staffingReader: StaffingReader,
  ) {}

  async getEventLiveOps(
    eventId: string,
    actor: ResolvedEventOpsActor,
  ): Promise<PrismLiveOps | PrismCoordinatorLiveOps> {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      'event-day live operations',
      eventId,
    );

    const coordinatorAssignment =
      actor.role === OpsUserRole.Coordinator
        ? await this.requireCoordinatorAssignmentForEvent(eventId, actor)
        : null;
    const data = await this.queries.liveOpsForEvent(eventId);
    if (!data.event) throw new NotFoundException('Event not found');
    const [coordinatorAssignments, guestCheckIns] = await Promise.all([
      coordinatorAssignment ? Promise.resolve([coordinatorAssignment]) : this.staffingReader.listAssignmentsForEvent(eventId),
      this.guestReader.listCheckInsForEvent(eventId),
    ]);

    const assignedCoordinator = coordinatorAssignment;
    const tasks = assignedCoordinator
      ? data.tasks.filter(
          (task) =>
            this.eventAccessPolicyService.sameText(task.assignedRole, assignedCoordinator.role) ||
            this.eventAccessPolicyService.sameText(task.ownerName, assignedCoordinator.coordinatorName) ||
            this.eventAccessPolicyService.sameText(task.assignedRole, 'General Coordinator'),
        )
      : data.tasks;
    const urgentIssues = assignedCoordinator
      ? data.urgentIssues.filter(
          (issue) =>
            !issue.ownerRole ||
            this.eventAccessPolicyService.sameText(issue.ownerRole, assignedCoordinator.role) ||
            this.eventAccessPolicyService.sameText(issue.ownerName, assignedCoordinator.coordinatorName),
        )
      : data.urgentIssues;
    const supplierStatuses = data.supplierRequests.map((request) => ({
      ...mapSupplierQuoteRequest(this.withExpiredQuoteRequestStatus(request)),
      verificationStatus: request.eventDayVerificationStatus ?? SupplierVerificationStatus.SelfReported,
      verifiedAt: request.eventDayVerifiedAt ? request.eventDayVerifiedAt.toISOString() : null,
      verifiedBy: request.eventDayVerifiedBy ?? null,
      verificationNotes: request.eventDayVerificationNotes ?? '',
    }));

    const mappedAssignments = coordinatorAssignments.map((assignment) =>
      mapCoordinatorAssignmentForEventDay(assignment, this.staffingReader.mapCoordinatorAssignment(assignment)),
    );

    const base: PrismLiveOps = {
      event: this.mapEvent(data.event),
      tasks: tasks.map(mapEventDayTask),
      urgentIssues: urgentIssues.map(mapUrgentIssue),
      supplierStatuses,
      coordinatorAssignments: mappedAssignments,
      guestAttendanceCount: guestCheckIns.length,
      guestCheckIns: guestCheckIns.map((checkIn) => this.guestReader.mapGuestCheckIn(checkIn)),
      eventDayLogs: data.eventDayLogs.map(mapEventDayLog),
    };

    if (actor.role === OpsUserRole.Coordinator) {
      if (!coordinatorAssignment) throw new ForbiddenException('Coordinator is not assigned to this event');
      return {
        ...base,
        role: coordinatorAssignment.role,
        supplierStatuses: supplierStatuses.map((status) => ({
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

  async getEventDayStatusFeed(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismEventDayStatusFeed> {
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      'event-day status feed',
      eventId,
    );
    const liveOps = await this.getEventLiveOps(eventId, actor);
    const includeGuestDetails =
      actor.role === OpsUserRole.PmcmAdmin ||
      actor.role === OpsUserRole.System ||
      Boolean(liveOps.role && this.isRegistrationRole(liveOps.role));

    return buildStatusFeed({
      event: liveOps.event,
      role: liveOps.role,
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

  async getCoordinatorRoleView(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismCoordinatorRoleView> {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Coordinator], 'coordinator role view', eventId);
    const assignment = await this.requireCoordinatorAssignmentForEvent(eventId, actor);
    const liveOps = await this.getEventLiveOps(eventId, actor);
    const { eventDayLogs: _eventDayLogs, ...coordinatorLiveOps } = liveOps;
    void _eventDayLogs;

    return {
      ...coordinatorLiveOps,
      assignment: mapCoordinatorAssignmentForEventDay(
        assignment,
        this.staffingReader.mapCoordinatorAssignment(assignment),
      ),
      role: assignment.role,
    };
  }

  private async requireCoordinatorAssignmentForEvent(eventId: string, actor: ResolvedEventOpsActor) {
    const assignment = await this.staffingReader.findAssignmentForEventActor(eventId, actor);
    if (!assignment) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'assigned event-day operations', eventId);
      throw new ForbiddenException('Coordinator is not assigned to this event');
    }
    return assignment;
  }

  private mapEvent(event: EventWithDrafts): PrismEvent {
    const floorPlanDrafts = event.floorPlanDrafts ?? [];
    const activeDraft =
      floorPlanDrafts.find((draft) => draft.isActive) ??
      floorPlanDrafts.find((draft) => draft.floorPlanId === event.floorPlanId);

    return {
      id: event.id,
      inquiryId: event.inquiryId,
      clientName: event.clientName,
      eventName: event.eventName,
      eventDate: event.eventDate.toISOString().slice(0, 10),
      status: event.status,
      clientPortalStatus: event.clientPortalStatus as 'locked' | 'unlocked',
      readiness: event.readiness,
      archived: event.archived,
      floorPlanStatus: event.floorPlanStatus,
      floorPlanId: event.floorPlanId,
      guestAccessCode: this.guestReader.guestAccessCode(event),
      activeFloorPlanDraftId: activeDraft?.id,
      floorPlanDrafts: floorPlanDrafts.map((draft) => this.floorplanReader.mapFloorPlanDraft(draft) as PrismFloorPlanDraft),
    };
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
      (request.status === SupplierQuoteRequestStatus.Open || request.status === SupplierQuoteRequestStatus.RevisionRequested)
    ) {
      return { ...request, status: SupplierQuoteRequestStatus.Expired } as OpsSupplierQuoteRequest;
    }
    return request;
  }
}
