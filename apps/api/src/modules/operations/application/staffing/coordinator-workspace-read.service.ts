import { Inject, Injectable } from '@nestjs/common';
import { GUEST_EVENT_PROJECTION_READER, type CoordinatorWorkspaceEventProjection, type GuestEventProjectionReader } from '@prism/contexts/read-models/guest-events';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { FLOORPLAN_READER, type FloorplanReader } from '@prism/contexts/floorplan';
import { GuestWorkflowService } from '../guest/guest-workflow.service';
import { CoordinatorsService } from './coordinators.service';

type EventWithDrafts = CoordinatorWorkspaceEventProjection;

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class CoordinatorWorkspaceReadService {
  constructor(
    @Inject(GUEST_EVENT_PROJECTION_READER) private readonly eventProjections: GuestEventProjectionReader,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly coordinatorsService: CoordinatorsService,
    @Inject(FLOORPLAN_READER) private readonly floorplanReader: FloorplanReader,
    private readonly guestWorkflowService: GuestWorkflowService,
  ) {}

  async listCoordinatorWorkspace(actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Coordinator], 'coordinator workspace');
    const coordinator = await this.coordinatorsService.resolveCoordinatorForActor(actor);
    const visibleAssignments = await this.coordinatorsService.listAssignmentsForCoordinator(
      coordinator.id,
      { includeHistorical: true },
    );
    const eventIds = new Set(visibleAssignments.map((assignment) => assignment.eventId));
    const events = await this.eventProjections.listCoordinatorWorkspaceEvents(Array.from(eventIds));

    return {
      coordinator: this.coordinatorsService.mapCoordinator(coordinator),
      assignments: visibleAssignments.map((assignment) => this.coordinatorsService.mapCoordinatorAssignment(assignment)),
      events: events.filter((event) => eventIds.has(event.id)).map((event) => this.mapEvent(event)),
    };
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
      venue: event.briefings?.[0]?.venue,
      status: event.status,
      clientPortalStatus: event.clientPortalStatus as 'locked' | 'unlocked',
      readiness: event.readiness,
      archived: event.archived,
      floorPlanStatus: event.floorPlanStatus,
      floorPlanId: event.floorPlanId,
      guestAccessCode: this.guestWorkflowService.guestAccessCode(event),
      activeFloorPlanDraftId: activeDraft?.id,
      floorPlanDrafts: floorPlanDrafts.map((draft) => this.floorplanReader.mapFloorPlanDraft(draft)),
    };
  }
}
