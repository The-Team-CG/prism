import { eventApi } from "@/lib/prism-api";

export const postEventDeliverablesRepository = {
  complete(eventId: string, documentId: string) {
    return eventApi.closure.completePostEventDocument(eventId, documentId);
  },
};
