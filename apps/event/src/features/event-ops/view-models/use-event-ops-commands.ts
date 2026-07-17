"use client";

import { eventOpsCommands, type EventOpsCommands } from "../use-cases/event-ops-commands";

/** Stable command handle for presentation (no direct HTTP client import). */
export function useEventOpsCommands(): EventOpsCommands {
  return eventOpsCommands;
}
