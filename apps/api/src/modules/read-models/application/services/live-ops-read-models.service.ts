import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsEvent, OpsFloorPlanDraft, OpsSupplierQuoteRequest } from '@prisma/client';
import type {
  PrismCoordinatorRoleView,
  PrismCoordinatorLiveOps,
  PrismEvent,
  PrismEventDayStatusFeed,
  PrismFloorPlanDraft,
  PrismBriefing,
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
import { deriveLiveOpsTimer, mapScheduleDay } from '../mappers/schedule-read-model.mappers';

type EventWithDrafts = OpsEvent & { floorPlanDrafts?: OpsFloorPlanDraft[] };
type ReassignmentQueryRow = {
  id: string;
  eventId: string;
  taskId: string;
  requestedBy: string;
  requestedByRole: string;
  fromOwnerRole: string;
  fromOwnerName: string;
  toOwnerRole: string;
  toOwnerName: string;
  reason: string;
  status: string;
  requestedAt: Date;
  autoApproveAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
  decisionReason: string | null;
};

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
    const { data, scheduleDays, reassignmentRequests, designatedOperator } = await this.loadW20Context(eventId, coordinatorAssignment);
    if (!data.event) throw new NotFoundException('Event not found');
    const [coordinatorAssignments, guestCheckIns, guestAttendanceCount] = await Promise.all([
      coordinatorAssignment && !designatedOperator
        ? Promise.resolve([coordinatorAssignment])
        : this.staffingReader.listAssignmentsForEvent(eventId),
      this.guestReader.listCheckInsForEvent(eventId),
      this.guestReader.countCheckInsForEvent(eventId),
    ]);

    const assignedCoordinator = coordinatorAssignment;
    const tasks = this.visibleTasks(data.tasks, assignedCoordinator, designatedOperator);
    const urgentIssues = this.visibleUrgentIssues(data.urgentIssues, assignedCoordinator, designatedOperator);
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
      briefing: data.briefing ? this.mapBriefing(data.briefing) : null,
      tasks: tasks.map(mapEventDayTask),
      urgentIssues: urgentIssues.map(mapUrgentIssue),
      supplierStatuses,
      coordinatorAssignments: mappedAssignments,
      guestAttendanceCount,
      guestCheckIns: guestCheckIns.map((checkIn) => this.guestReader.mapGuestCheckIn(checkIn)),
      eventDayLogs: data.eventDayLogs.map(mapEventDayLog),
      isDesignatedOperator: designatedOperator,
      canMarkDelegatedAttendance: designatedOperator,
      taskReassignmentRequests: (!coordinatorAssignment || designatedOperator)
        ? reassignmentRequests.map((request) => this.mapReassignmentRequest(request))
        : [],
      schedule: { eventId, authored: scheduleDays.length > 0, days: scheduleDays.map(mapScheduleDay), serverTime: new Date().toISOString() },
      timer: deriveLiveOpsTimer({ eventId, authored: scheduleDays.length > 0, days: scheduleDays.map(mapScheduleDay), serverTime: new Date().toISOString() }, new Date()),
    };

    if (actor.role !== OpsUserRole.Coordinator) return base;
    return this.mapCoordinatorLiveOps(base, coordinatorAssignment, designatedOperator);
  }

  private mapCoordinatorLiveOps(
    base: PrismLiveOps,
    assignment: Awaited<ReturnType<LiveOpsReadModelsService['requireCoordinatorAssignmentForEvent']>> | null,
    designatedOperator: boolean,
  ): PrismCoordinatorLiveOps {
    if (!assignment) throw new ForbiddenException('Coordinator is not assigned to this event');
    return {
      ...base,
      role: assignment.role,
      isDesignatedOperator: designatedOperator,
      canMarkDelegatedAttendance: designatedOperator,
      supplierStatuses: designatedOperator || this.isIngressRole(assignment.role)
        ? base.supplierStatuses.map((status) => ({
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
          }))
        : [],
      guestCheckIns: this.isRegistrationRole(assignment.role) ? base.guestCheckIns : [],
    };
  }

  private async loadW20Context(eventId: string, coordinatorAssignment: Awaited<ReturnType<LiveOpsReadModelsService['requireCoordinatorAssignmentForEvent']>> | null) {
    type ScheduleRow = Parameters<typeof mapScheduleDay>[0];
    const scheduleQuery = (this.queries as EventReadModelQueries & { scheduleForEvent?: (id: string) => Promise<ScheduleRow[]> }).scheduleForEvent;
    const reassignmentQuery = (this.queries as EventReadModelQueries & { taskReassignmentRequests?: (id: string) => Promise<ReassignmentQueryRow[]> }).taskReassignmentRequests;
    const [data, scheduleDays, reassignmentRequests] = await Promise.all([
      this.queries.liveOpsForEvent(eventId),
      scheduleQuery ? scheduleQuery.call(this.queries, eventId) : Promise.resolve([] as ScheduleRow[]),
      reassignmentQuery ? reassignmentQuery.call(this.queries, eventId) : Promise.resolve([]),
    ]);
    const operatorQuery = (this.queries as EventReadModelQueries & { activeOperatorForCoordinator?: (id: string, coordinatorId: string) => Promise<unknown> }).activeOperatorForCoordinator;
    const designatedOperator = Boolean(
      coordinatorAssignment?.coordinatorId &&
      await operatorQuery?.call(this.queries, eventId, coordinatorAssignment.coordinatorId),
    );
    return { data, scheduleDays, reassignmentRequests, designatedOperator };
  }

  private visibleTasks(tasks: Awaited<ReturnType<EventReadModelQueries['liveOpsForEvent']>>['tasks'], assignment: Awaited<ReturnType<LiveOpsReadModelsService['requireCoordinatorAssignmentForEvent']>> | null, designatedOperator: boolean) {
    if (!assignment || designatedOperator) return tasks;
    return tasks.filter((task) =>
      this.eventAccessPolicyService.sameText(task.assignedRole, assignment.role) ||
      this.eventAccessPolicyService.sameText(task.ownerName, assignment.coordinatorName) ||
      this.eventAccessPolicyService.sameText(task.assignedRole, 'General Coordinator'),
    );
  }

  private visibleUrgentIssues(issues: Awaited<ReturnType<EventReadModelQueries['liveOpsForEvent']>>['urgentIssues'], assignment: Awaited<ReturnType<LiveOpsReadModelsService['requireCoordinatorAssignmentForEvent']>> | null, designatedOperator: boolean) {
    if (!assignment || designatedOperator) return issues;
    return issues.filter((issue) => {
      const roleMatches = Boolean(issue.ownerRole?.trim()) && this.eventAccessPolicyService.sameText(issue.ownerRole, assignment.role);
      const ownerMatches = Boolean(issue.ownerName?.trim()) && this.eventAccessPolicyService.sameText(issue.ownerName, assignment.coordinatorName);
      return roleMatches || ownerMatches;
    });
  }

  private mapReassignmentRequest(request: ReassignmentQueryRow) {
    return {
      id: request.id,
      eventId: request.eventId,
      taskId: request.taskId,
      requestedBy: request.requestedBy,
      requestedByRole: request.requestedByRole,
      fromOwnerRole: request.fromOwnerRole,
      fromOwnerName: request.fromOwnerName,
      toOwnerRole: request.toOwnerRole,
      toOwnerName: request.toOwnerName,
      reason: request.reason,
      status: request.status,
      requestedAt: request.requestedAt.toISOString(),
      autoApproveAt: request.autoApproveAt.toISOString(),
      decidedAt: request.decidedAt?.toISOString() ?? null,
      decidedBy: request.decidedBy ?? null,
      decisionReason: request.decisionReason ?? null,
    };
  }

  private mapBriefing(briefing: { eventId: string; venue: string; guestCount: number; budgetRange: string; serviceRequirements: unknown; notes: string; submittedAt: Date }): PrismBriefing {
    return {
      eventId: briefing.eventId,
      venue: briefing.venue,
      guestCount: briefing.guestCount,
      budgetRange: briefing.budgetRange,
      serviceRequirements: Array.isArray(briefing.serviceRequirements)
        ? briefing.serviceRequirements.filter((item): item is string => typeof item === 'string')
        : [],
      notes: briefing.notes,
      submittedAt: briefing.submittedAt.toISOString(),
    };
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
      walkInPolicy: event.walkInPolicy as 'closed' | 'open' | 'threshold',
      walkInThreshold: event.walkInThreshold,
      actualEndedAt: event.actualEndedAt?.toISOString() ?? null,
      actualEndedBy: event.actualEndedBy,
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

  private isIngressRole(role?: string | null) {
    const value = role?.toLowerCase() ?? '';
    return value.includes('ingress') || value.includes('egress');
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
