import type { Prisma } from '@prisma/client';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';

export const PARTICIPANT_READER = Symbol.for('prism.identityAccess.participantReader');

export interface ParticipantReader {
  resolveForEvent(actorId: string, eventId: string, db?: Prisma.TransactionClient): Promise<ResolvedEventOpsActor>;
  listEligibleForEvent(eventId: string, requester: ResolvedEventOpsActor): Promise<Array<{ id: string; name: string; email: string; role: string }>>;
  /** PMCM admins who receive a conversation a booked supplier opens; never exposed to the supplier. */
  listPmcmAdmins(db?: Prisma.TransactionClient): Promise<ResolvedEventOpsActor[]>;
  /** The events, out of `eventIds`, whose conversations this account may still read. Records no denied-access entry. */
  readableEventIds(actorId: string, eventIds: string[]): Promise<Set<string>>;
  /** Account display names by id, for people who already share a conversation. Never emails. */
  displayNames(actorIds: string[], db?: Prisma.TransactionClient): Promise<Map<string, string>>;
}
