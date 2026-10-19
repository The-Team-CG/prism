import { eventApi } from "@/lib/prism-api";
import type { PrismEventRiskView, RecordEventRiskAssessmentInput } from "@prism/types";

export const riskAssessmentRepository = {
  load(eventId: string): Promise<PrismEventRiskView> {
    return eventApi.events.riskAssessment(eventId);
  },
  record(eventId: string, input: RecordEventRiskAssessmentInput): Promise<PrismEventRiskView> {
    return eventApi.events.recordRiskAssessment(eventId, input);
  },
};
