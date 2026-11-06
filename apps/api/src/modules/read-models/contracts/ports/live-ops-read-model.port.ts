import type {
  PrismCoordinatorRoleView,
  PrismCoordinatorLiveOps,
  PrismEventDayStatusFeed,
  PrismLiveOps,
} from '@prism/types';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';

export interface LiveOpsReadModel {
  getEventLiveOps(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismLiveOps | PrismCoordinatorLiveOps>;
  getEventDayStatusFeed(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismEventDayStatusFeed>;
  getCoordinatorRoleView(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismCoordinatorRoleView>;
  /** The role view for the coordinator's focus event (next upcoming, else latest), or null with no active assignment. */
  getCoordinatorFocusRoleView(actor: ResolvedEventOpsActor): Promise<PrismCoordinatorRoleView | null>;
}
