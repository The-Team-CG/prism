"use client";

import { useMemo } from "react";
import { eventOpsCommands, type EventOpsCommands } from "../use-cases/event-ops-commands";

/** View-model surface: presentation binds to these commands only (no direct HTTP). */
export function useEventOpsCommands(): EventOpsCommands {
  return useMemo(() => eventOpsCommands, []);
}
