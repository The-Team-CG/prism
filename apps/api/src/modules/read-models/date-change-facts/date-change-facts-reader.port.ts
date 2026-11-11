import type { ApprovedWorkFactsShape, MilestoneFactsShape } from './date-change-facts.types';

export type { ApprovedWorkFactsShape, MilestoneFactsShape } from './date-change-facts.types';

export interface DateChangeSupplierFacts {
  requestId: string;
  supplierId: string | null;
  supplierName: string;
  category: string;
  assignmentStatus: string;
  /** Marked unavailable on the date being considered. Always false when no date is being considered. */
  blockedOnNewDate: boolean;
  /** Other events this supplier is already booked for on the date being considered. */
  otherEventsOnNewDate: string[];
}

export interface DateChangeFacts {
  eventId: string;
  eventName: string;
  eventDate: Date;
  archived: boolean;
  suppliers: DateChangeSupplierFacts[];
  milestones: MilestoneFactsShape[];
  approved: ApprovedWorkFactsShape;
}

/**
 * Read-only facts about what an event's date touches in other contexts: supplier bookings and their conflicts, payment
 * milestones, and what the client already approved. It never writes, so no context's records can change through it.
 */
export interface DateChangeFactsReader {
  /** `newDateKey` is the Philippine calendar date being considered, or null to read the event as it stands. */
  getFacts(eventId: string, newDateKey: string | null): Promise<DateChangeFacts | null>;
}

export const DATE_CHANGE_FACTS_READER = Symbol('DATE_CHANGE_FACTS_READER');
