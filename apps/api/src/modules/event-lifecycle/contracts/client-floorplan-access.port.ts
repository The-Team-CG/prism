import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type {
  PrismApprovedClientAccount,
  PrismClientSharedFloorplanEvent,
  PrismEventClientAccess,
} from '@prism/types';

export const EVENT_CLIENT_FLOORPLAN_ACCESS_COMMANDS = Symbol.for('prism.eventLifecycle.clientFloorplanAccessCommands');
export const EVENT_CLIENT_FLOORPLAN_ACCESS_READER = Symbol.for('prism.eventLifecycle.clientFloorplanAccessReader');

export interface EventClientFloorplanAccessCommands {
  listAccess(eventId: string, actor: ResolvedEventOpsActor): Promise<PrismEventClientAccess>;
  searchCandidates(eventId: string, query: string, actor: ResolvedEventOpsActor): Promise<PrismApprovedClientAccount[]>;
  grant(eventId: string, userId: string, actor: ResolvedEventOpsActor): Promise<PrismEventClientAccess>;
  revoke(eventId: string, userId: string, actor: ResolvedEventOpsActor): Promise<PrismEventClientAccess>;
}

export interface EventClientFloorplanAccessReader {
  hasActiveGrant(eventId: string, userId: string): Promise<boolean>;
  listActiveSharedEvents(userId: string): Promise<PrismClientSharedFloorplanEvent[]>;
}
