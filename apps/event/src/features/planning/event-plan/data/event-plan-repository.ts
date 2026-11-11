import { defineResource } from "@prism/portal-query";
import type { ApplyEventPlanInput, PreviewEventPlanInput, UpdateEventPlanItemInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

/** One event's plan. Short freshness: PMCM ticks tasks off and reapplies templates here. */
export const eventPlan = defineResource({
  name: "planning.event-plan",
  staleMs: 5_000,
  fetch: (eventId: string, signal) => eventApi.planning.eventPlan(eventId, { signal }),
});

export const planRepository = {
  preview: (eventId: string, input: PreviewEventPlanInput) => eventApi.planning.previewPlan(eventId, input),
  apply: (eventId: string, input: ApplyEventPlanInput) => eventApi.planning.applyPlan(eventId, input),
  updateItem: (eventId: string, itemId: string, input: UpdateEventPlanItemInput) => eventApi.planning.updatePlanItem(eventId, itemId, input),
};

export type PlanCommands = typeof planRepository;
