import type { PrismLogisticsCompletion, RecordLogisticsCompletionInput } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const logisticsCompletionRepository = {
  get(eventId: string): Promise<PrismLogisticsCompletion | null> {
    return eventApiRequest<PrismLogisticsCompletion | null>(`/api/events/${eventId}/logistics-completion`);
  },
  record(eventId: string, input: RecordLogisticsCompletionInput): Promise<PrismLogisticsCompletion> {
    return eventApiRequest<PrismLogisticsCompletion>(`/api/events/${eventId}/logistics-completion`, { method: "POST", body: input });
  },
};
