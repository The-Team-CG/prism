import { eventApi as eventOpsClient, eventApiRequest as request } from "@/lib/prism-api";
import type { CreateRegistrationPlatformInput, ImportHeadcountInput, ImportGuestRosterInput, UpdateWalkInPolicyInput, GuestRosterSearchInput, UpdateGuestVerificationInput, UpdateRegistrationPlatformInput, UpdateGuestPrivacyClassificationInput } from "@prism/types";

export const guestCommands = {
checkInGuestRoster: (eventId: string, rosterEntryId: string) => eventOpsClient.guest.checkInRoster(eventId, rosterEntryId),
getGuestPrivacyClassification: (eventId: string) => eventOpsClient.guest.guestPrivacyClassification(eventId),
listGuestQrPasses: (eventId: string, rosterEntryIds: readonly string[]) => eventOpsClient.guest.guestQrPasses(eventId, rosterEntryIds),
issueGuestQrPass: (eventId: string, rosterEntryId: string) => eventOpsClient.guest.issueGuestQrPass(eventId, rosterEntryId),
retryGuestQrPass: (eventId: string, passId: string) => eventOpsClient.guest.retryGuestQrPass(eventId, passId),
reissueGuestQrPass: (eventId: string, passId: string) => eventOpsClient.guest.reissueGuestQrPass(eventId, passId),
revokeGuestQrPass: (eventId: string, passId: string) => eventOpsClient.guest.revokeGuestQrPass(eventId, passId),
getWalkInPolicy: (eventId: string) => eventOpsClient.guest.walkInPolicy(eventId),
importGuestRoster: (eventId: string, input: ImportGuestRosterInput) => eventOpsClient.guest.importRoster(eventId, input),
importHeadcount: (eventId: string, input: ImportHeadcountInput) =>
    eventOpsClient.pmcm.importHeadcount(eventId, input),
searchGuestRosterWithFilters: (eventId: string, filters: GuestRosterSearchInput) => eventOpsClient.guest.searchRoster(eventId, filters),
updateGuestPrivacyClassification: (eventId: string, input: UpdateGuestPrivacyClassificationInput) => eventOpsClient.guest.updateGuestPrivacyClassification(eventId, input),
updateWalkInPolicy: (eventId: string, input: UpdateWalkInPolicyInput) => eventOpsClient.guest.updateWalkInPolicy(eventId, input),
upsertRegistrationPlatform: (eventId: string, input: CreateRegistrationPlatformInput) =>
    eventOpsClient.pmcm.upsertRegistrationPlatform(eventId, input),
  updateRegistrationPlatform: (eventId: string, input: UpdateRegistrationPlatformInput) =>
    eventOpsClient.pmcm.updateRegistrationPlatform(eventId, input),
verifyGuestRoster: (eventId: string, rosterEntryId: string, status: UpdateGuestVerificationInput["status"]) => eventOpsClient.guest.verifyRoster(eventId, rosterEntryId, { status }),
};
