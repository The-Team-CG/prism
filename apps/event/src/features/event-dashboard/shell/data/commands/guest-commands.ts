import { eventApi as eventOpsClient, eventApiRequest as request } from "@/lib/prism-api";
import type { CreateRegistrationPlatformInput, ImportHeadcountInput, ImportGuestRosterInput, UpdateWalkInPolicyInput, GuestRosterSearchInput, UpdateGuestVerificationInput, UpdateRegistrationPlatformInput } from "@prism/types";

export const guestCommands = {
checkInGuestRoster: (eventId: string, rosterEntryId: string) => eventOpsClient.guest.checkInRoster(eventId, rosterEntryId),
getWalkInPolicy: (eventId: string) => eventOpsClient.guest.walkInPolicy(eventId),
importGuestRoster: (eventId: string, input: ImportGuestRosterInput) => eventOpsClient.guest.importRoster(eventId, input),
importHeadcount: (eventId: string, input: ImportHeadcountInput) =>
    eventOpsClient.pmcm.importHeadcount(eventId, input),
searchGuestRosterWithFilters: (eventId: string, filters: GuestRosterSearchInput) => eventOpsClient.guest.searchRoster(eventId, filters),
updateWalkInPolicy: (eventId: string, input: UpdateWalkInPolicyInput) => eventOpsClient.guest.updateWalkInPolicy(eventId, input),
upsertRegistrationPlatform: (eventId: string, input: CreateRegistrationPlatformInput) =>
    eventOpsClient.pmcm.upsertRegistrationPlatform(eventId, input),
  updateRegistrationPlatform: (eventId: string, input: UpdateRegistrationPlatformInput) =>
    eventOpsClient.pmcm.updateRegistrationPlatform(eventId, input),
verifyGuestRoster: (eventId: string, rosterEntryId: string, status: UpdateGuestVerificationInput["status"]) => eventOpsClient.guest.verifyRoster(eventId, rosterEntryId, { status }),
};
