import type { DecideCoordinatorReplacementInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const coordinatorReplacementRepository = {
  list: (eventId: string) => eventApi.staffing.replacementRecommendations(eventId),
  decide: (eventId: string, id: string, input: DecideCoordinatorReplacementInput) => eventApi.staffing.decideReplacement(eventId, id, input),
};
