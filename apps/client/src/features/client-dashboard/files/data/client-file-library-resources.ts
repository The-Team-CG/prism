import { defineResource } from "@prism/portal-query";
import type { PrismStoredObject } from "@prism/types";
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

export type ClientEventStoredFiles = { eventId: string; objects: PrismStoredObject[] };

/**
 * Stored files across several of the client's events, read only when the client searches all events or picks a
 * file to reuse. Each event is read through its own scoped endpoint; an event that fails to load is left out.
 */
export const clientAccountStoredFiles = defineResource({
  name: "client.account-stored-files",
  staleMs: 60_000,
  fetch: async (eventIds: string[]): Promise<ClientEventStoredFiles[]> => {
    const results = await Promise.allSettled(eventIds.map((eventId) => clientStoredFilesRepository.list(eventId)));
    return results.flatMap((result, index) => (result.status === "fulfilled" ? [{ eventId: eventIds[index], objects: result.value }] : []));
  },
});
