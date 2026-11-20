import { eventApi } from "@/lib/prism-api";
import type { PrismFloorplanSeatingGuest } from "@prism/types";
import { seatingGuestsFromRoster } from "../model/seating";

/** The event's guest roster as the floor plan editor seats it. */
export async function loadSeatingGuests(eventId: string): Promise<PrismFloorplanSeatingGuest[]> {
  return seatingGuestsFromRoster(await eventApi.guest.roster(eventId));
}
