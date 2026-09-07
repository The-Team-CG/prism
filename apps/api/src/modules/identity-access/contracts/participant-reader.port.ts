import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';

export const PARTICIPANT_READER = Symbol.for('prism.identityAccess.participantReader');

export interface ParticipantReader {
  resolveForEvent(actorId: string, eventId: string): Promise<ResolvedEventOpsActor>;
  listEligibleForEvent(eventId: string, requester: ResolvedEventOpsActor): Promise<Array<{ id: string; name: string; email: string; role: string }>>;
}
