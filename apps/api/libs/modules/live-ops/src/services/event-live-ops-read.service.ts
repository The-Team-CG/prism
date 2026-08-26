import { Inject, Injectable } from '@nestjs/common';
import type {
  PrismCoordinatorLiveOps,
  PrismCoordinatorRoleView,
  PrismEventDayStatusFeed,
  PrismLiveOps,
} from '@prism/types';
import {
  LIVE_OPS_READ_MODEL,
  type LiveOpsReadModel,
} from '@prism/modules/event-read-models';
import type { ResolvedEventOpsActor } from '@prism/modules/access-control';

/**
 * Route-facing adapter retained for the live-ops controllers.
 * Composition and persistence live in event-read-models.
 */
@Injectable()
export class EventLiveOpsReadService {
  constructor(@Inject(LIVE_OPS_READ_MODEL) private readonly readModel: LiveOpsReadModel) {}

  getEventLiveOps(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismLiveOps | PrismCoordinatorLiveOps> {
    return this.readModel.getEventLiveOps(eventId, actor);
  }

  getEventDayStatusFeed(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismEventDayStatusFeed> {
    return this.readModel.getEventDayStatusFeed(eventId, actor);
  }

  getCoordinatorRoleView(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismCoordinatorRoleView> {
    return this.readModel.getCoordinatorRoleView(eventId, actor);
  }
}
