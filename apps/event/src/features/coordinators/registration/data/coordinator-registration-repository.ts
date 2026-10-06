import type { CoordinatorWalkInCheckInInput, PrismCoordinatorRegistrationEntry, PrismGuestCheckIn, UpdateGuestVerificationInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const coordinatorRegistrationRepository = {
  search(eventId: string, query: string, reviewQueue = false): Promise<PrismCoordinatorRegistrationEntry[]> {
    return eventApi.guest.registrationRoster(eventId, {
      ...(query ? { query } : {}),
      ...(reviewQueue ? { reviewQueue: true } : {}),
    });
  },
  checkIn(eventId: string, rosterEntryId: string): Promise<PrismGuestCheckIn> {
    return eventApi.guest.checkInRoster(eventId, rosterEntryId);
  },
  verify(eventId: string, rosterEntryId: string, status: UpdateGuestVerificationInput["status"]): Promise<unknown> {
    return eventApi.guest.verifyRegistrationRoster(eventId, rosterEntryId, { status });
  },
  registerWalkIn(eventId: string, input: CoordinatorWalkInCheckInInput): Promise<PrismCoordinatorRegistrationEntry> {
    return eventApi.guest.registerWalkIn(eventId, input);
  },
};
