import { Injectable } from '@nestjs/common';
import type { OpsEvent, OpsFloorPlanDraft } from '@prisma/client';
import { PrismaService } from '@prism/database';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/modules/access-control';
import { OpsUserRole } from '@prism/modules/event-core';
import { FloorPlanWorkflowService } from '@prism/contexts/floorplan';
import { GuestWorkflowService } from '@prism/modules/guest-ops';
import { CoordinatorsService } from './coordinators.service';

type EventWithDrafts = OpsEvent & { floorPlanDrafts?: OpsFloorPlanDraft[] };

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class CoordinatorWorkspaceReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly coordinatorsService: CoordinatorsService,
    private readonly floorPlanWorkflowService: FloorPlanWorkflowService,
    private readonly guestWorkflowService: GuestWorkflowService,
  ) {}

  async listCoordinatorWorkspace(actor: ResolvedEventOpsActor) {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Coordinator], 'coordinator workspace');
    const coordinator = await this.coordinatorsService.resolveCoordinatorForActor(actor);
    const visibleAssignments = await this.coordinatorsService.listAssignmentsForCoordinator(
      coordinator.id,
      coordinator.name,
    );
    const eventIds = new Set(visibleAssignments.map((assignment) => assignment.eventId));
    const events = await this.prisma.opsEvent.findMany({
      where: { archived: false },
      include: { floorPlanDrafts: { orderBy: { updatedAt: 'desc' } } },
      orderBy: { eventDate: 'asc' },
    });

    return {
      coordinator: this.coordinatorsService.mapCoordinator(coordinator),
      assignments: visibleAssignments.map((assignment) => this.coordinatorsService.mapCoordinatorAssignment(assignment)),
      events: events.filter((event) => eventIds.has(event.id)).map((event) => this.mapEvent(event as EventWithDrafts)),
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
