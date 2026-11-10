import type { CreateComplianceRiskInput, PrismComplianceRisk, PrismComplianceRun } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const complianceReviewRepository = {
  listRuns(eventId: string): Promise<PrismComplianceRun[]> {
    return eventApi.compliance.runs(eventId);
  },
  listRisks(eventId: string): Promise<PrismComplianceRisk[]> {
    return eventApi.compliance.risks(eventId);
  },
  createRisk(eventId: string, input: CreateComplianceRiskInput): Promise<PrismComplianceRisk> {
    return eventApi.compliance.createRisk(eventId, input);
  },
};
