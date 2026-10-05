import type { Prisma } from '@prisma/client';

export const PARTICIPANT_FACTS = Symbol.for('prism.readModels.participantFacts');

export type ParticipantEventFacts = {
  event: { id: string; clientName: string; clientPortalStatus: string; inquiryEmail: string | null };
  supplierAssignments: Array<{ supplierId: string | null; status: string }>;
  suppliers: Array<{ id: string; email: string }>;
  coordinatorAssignments: Array<{ coordinatorId: string | null; status: string }>;
  coordinators: Array<{ id: string; userId: string | null }>;
};

/** Read-only, serializable facts used to decide who may join event communication. */
export interface ParticipantFactsReader {
  findForEvent(eventId: string, db?: Prisma.TransactionClient): Promise<ParticipantEventFacts | null>;
}
