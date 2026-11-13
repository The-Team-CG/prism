import { defineResource } from "@prism/portal-query";
import { clientStoredFilesRepository } from "./client-stored-files-repository";

/** One event's stored files the client can see: their uploads and what PMCM shared. */
export const clientEventStoredFiles = defineResource({
  name: "client.event-stored-files",
  fetch: (eventId: string) => clientStoredFilesRepository.list(eventId),
});

/** One event's document requirements, client-safe. The event list reads it to count what each event still needs. */
export const clientEventFileRequirements = defineResource({
  name: "client.event-file-requirements",
  fetch: (eventId: string) => clientStoredFilesRepository.requirements(eventId),
});
