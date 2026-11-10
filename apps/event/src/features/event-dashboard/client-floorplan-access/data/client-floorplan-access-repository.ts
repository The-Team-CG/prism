import { eventApi } from "@/lib/prism-api";

export const clientFloorplanAccessRepository = {
  listAccess(eventId: string) {
    return eventApi.floorplans.clientAccess(eventId);
  },

  searchCandidates(eventId: string, query: string) {
    return eventApi.floorplans.searchClientCandidates(eventId, query);
  },

  grant(eventId: string, userId: string) {
    return eventApi.floorplans.grantClientAccess(eventId, userId);
  },

  revoke(eventId: string, userId: string) {
    return eventApi.floorplans.revokeClientAccess(eventId, userId);
  },
};
