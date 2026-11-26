import { defineResource } from "@prism/portal-query";
import { contextNotesRepository } from "./context-notes-repository";

/** The inquiry's pre-conforme notes as the event workspace shows them. */
export const eventPreConformeContext = defineResource({
  name: "inquiries.event-pre-conforme-context",
  fetch: (eventId: string) => contextNotesRepository.forEvent(eventId),
});
