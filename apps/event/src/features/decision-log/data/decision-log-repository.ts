import type { PrismDecisionLog, PrismDecisionLogQuery } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const decisionLogRepository = {
  load(eventId: string, query: PrismDecisionLogQuery): Promise<PrismDecisionLog> {
    return eventApi.pmcm.decisionLog(eventId, query);
  },
};
