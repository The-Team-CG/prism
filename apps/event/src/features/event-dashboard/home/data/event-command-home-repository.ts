/**
 * I/O facade for the PMCM command home surface.
 * Prefer view-model commands (`useEventOpsCommands`); this repo remains for non-view loaders.
 */
import { eventOpsRepository } from "@/features/event-ops";

export const eventCommandHomeRepository = eventOpsRepository;
