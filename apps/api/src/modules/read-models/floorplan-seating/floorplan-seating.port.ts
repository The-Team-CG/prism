import type { Prisma } from '@prisma/client';
import type { TableEligibilityGuest } from '@prism/types';

export const FLOORPLAN_SEATING_FACTS = Symbol.for('prism.readModels.floorplanSeatingFacts');

/** A roster guest a scene may seat, with the name a converted legacy plan matches its own guests by. */
export type FloorplanSeatingGuest = TableEligibilityGuest & { name: string };

/** What a floor plan scene is checked against when it is saved: who may be seated, and who may hold a zone. */
export interface FloorplanSeatingFactsReader {
  /** The event roster's guests who can be seated: not withdrawn and eligible, each with their RSVP and name. */
  listSeatingGuests(eventId: string, db?: Prisma.TransactionClient): Promise<FloorplanSeatingGuest[]>;
  /** Suppliers booked on the event: a selected quote request naming them. */
  bookedSupplierIds(eventId: string, db?: Prisma.TransactionClient): Promise<Set<string>>;
}
