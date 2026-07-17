import { eventOpsRepository } from "../data/event-ops-repository";

/**
 * Application command surface for PMCM product actions.
 * Same object as the repository today — a dedicated use-case module keeps
 * the import direction ViewModel → use-case → data when we add orchestration.
 */
export const eventOpsCommands = eventOpsRepository;

export type EventOpsCommands = typeof eventOpsCommands;
