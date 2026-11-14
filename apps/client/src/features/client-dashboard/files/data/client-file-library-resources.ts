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

/** The client's stored files across all of their events matching a file name, read in one request; "" lists the newest. */
export const clientStoredFileSearch = defineResource({
  name: "client.stored-file-search",
  fetch: (query: string, signal) => clientStoredFilesRepository.search(query, signal),
});
