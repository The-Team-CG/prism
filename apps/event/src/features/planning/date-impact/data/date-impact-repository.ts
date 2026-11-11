import { defineResource } from "@prism/portal-query";
import type { SyncEventPlanInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export interface DateImpactKey {
  eventId: string;
  /** The date being considered, or null for the date the event has now. */
  newDate: string | null;
}

/** What a date change touches. Read only, and short-lived: it changes whenever a booking, payment or task does. */
export const dateImpact = defineResource({
  name: "planning.date-impact",
  staleMs: 5_000,
  fetch: (key: DateImpactKey, signal) => eventApi.planning.dateChangeImpact(key.eventId, key.newDate ? { newDate: key.newDate } : {}, { signal }),
});

export const dateImpactRepository = {
  syncPlan: (eventId: string, input: SyncEventPlanInput) => eventApi.planning.syncPlan(eventId, input),
};

export type DateImpactCommands = typeof dateImpactRepository;
