import type { PrismLogisticsCompletion, RecordLogisticsCompletionInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const logisticsCompletionRepository = {
  get(eventId: string): Promise<PrismLogisticsCompletion | null> {
    return eventApi.closure.logisticsCompletion(eventId);
  },
  record(eventId: string, input: RecordLogisticsCompletionInput): Promise<PrismLogisticsCompletion> {
    return eventApi.closure.recordLogisticsCompletion(eventId, input);
  },
};
