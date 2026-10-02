import { eventApi } from "@/lib/prism-api";
import type { PrismEventDecision } from "@prism/types";

export const eventDecisionRepository = {
  list(eventId: string): Promise<PrismEventDecision[]> {
    return eventApi.events.decisionHistory(eventId);
  },
};
