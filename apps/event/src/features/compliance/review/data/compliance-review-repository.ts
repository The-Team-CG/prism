import type { CreateComplianceRiskInput, PrismComplianceRisk, PrismComplianceRun } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const complianceReviewRepository = {
  listRuns(eventId: string): Promise<PrismComplianceRun[]> {
    return eventApiRequest<PrismComplianceRun[]>(`/api/events/${eventId}/compliance/runs`);
  },
  listRisks(eventId: string): Promise<PrismComplianceRisk[]> {
    return eventApiRequest<PrismComplianceRisk[]>(`/api/events/${eventId}/compliance/risks`);
  },
  createRisk(eventId: string, input: CreateComplianceRiskInput): Promise<PrismComplianceRisk> {
    return eventApiRequest<PrismComplianceRisk>(`/api/events/${eventId}/compliance/risks`, { method: "POST", body: input });
  },
};
