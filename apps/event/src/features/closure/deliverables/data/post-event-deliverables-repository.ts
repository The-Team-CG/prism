import type { PrismPostEventDocument } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const postEventDeliverablesRepository = {
  complete(eventId: string, documentId: string) {
    return eventApiRequest<PrismPostEventDocument>(`/api/events/${encodeURIComponent(eventId)}/post-event-documents/${encodeURIComponent(documentId)}/complete`, { method: "PATCH" });
  },
};
