import { Inject, Injectable } from '@nestjs/common';
import type {
  PrismCoordinatorEventSchedule,
  PrismCoordinatorLiveOps,
  PrismCoordinatorRoleView,
  PrismEventDayStatusFeed,
  PrismLiveOps,
} from '@prism/types';
import {
  LIVE_OPS_READ_MODEL,
  type LiveOpsReadModel,
} from '@prism/contexts/read-models';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';

/**
 * Route-facing adapter retained for the live-ops controllers.
 * Composition and persistence live in event-read-models.
 */
@Injectable()
export class EventLiveOpsReadService {
  constructor(
    @Inject(LIVE_OPS_READ_MODEL) private readonly readModel: LiveOpsReadModel,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  getEventLiveOps(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismLiveOps | PrismCoordinatorLiveOps> {
    return this.readModel.getEventLiveOps(eventId, actor);
  }

  getEventDayStatusFeed(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismEventDayStatusFeed> {
    return this.readModel.getEventDayStatusFeed(eventId, actor);
  }

  getCoordinatorRoleView(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismCoordinatorRoleView> {
    return this.readModel.getCoordinatorRoleView(eventId, actor);
  }

  getCoordinatorFocusRoleView(actor: ResolvedEventOpsActor): Promise<PrismCoordinatorRoleView | null> {
    return this.readModel.getCoordinatorFocusRoleView(actor);
  }

  /**
   * Published schedule and event status for a coordinator. The read model enforces the event assignment;
   * the role gate here keeps PMCM and other actors on their own surfaces.
   */
  async getCoordinatorEventSchedule(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismCoordinatorEventSchedule> {
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Coordinator], 'coordinator event schedule', eventId);
    const liveOps = await this.readModel.getEventLiveOps(eventId, actor);
    if (!liveOps.schedule) {
      throw new Error(`Live ops read model returned no schedule for event ${eventId}`);
    }
    return { eventId, eventStatus: liveOps.event.status, schedule: liveOps.schedule };
  }
}
