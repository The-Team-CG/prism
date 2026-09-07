import type { CreateComplianceRiskInput, PrismComplianceRisk, PrismComplianceRun } from "@prism/types";
import { prismApi } from "@/lib/prism-api";

export const complianceReviewRepository = {
  listRuns(eventId: string): Promise<PrismComplianceRun[]> { return prismApi.complianceRuns(eventId); },
  listRisks(eventId: string): Promise<PrismComplianceRisk[]> { return prismApi.complianceRisks(eventId); },
  createRisk(eventId: string, input: CreateComplianceRiskInput): Promise<PrismComplianceRisk> { return prismApi.createComplianceRisk(eventId, input); },
};
