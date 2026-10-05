import type { PrismApprovedClientAccount, PrismEventClientAccess } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

function accessPath(eventId: string) {
  return `/api/events/${encodeURIComponent(eventId)}/client-floorplan-access`;
}

export const clientFloorplanAccessRepository = {
  listAccess(eventId: string) {
    return eventApiRequest<PrismEventClientAccess>(accessPath(eventId));
  },

  searchCandidates(eventId: string, query: string) {
    const search = new URLSearchParams({ query });
    return eventApiRequest<PrismApprovedClientAccount[]>(
      `${accessPath(eventId)}/candidates?${search.toString()}`,
    );
  },

  grant(eventId: string, userId: string) {
    return eventApiRequest<PrismEventClientAccess>(accessPath(eventId), {
      method: "POST",
      body: { userId },
    });
  },

  revoke(eventId: string, userId: string) {
    return eventApiRequest<PrismEventClientAccess>(
      `${accessPath(eventId)}/${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
  },
};
