import { parseContract, updateComplianceRiskSchema, type PrismComplianceRisk, type UpdateComplianceRiskInput } from "@prism/types";
import { complianceReviewRepository } from "../data/compliance-review-repository";

/** PMCM moves a risk along (mitigated, accepted, closed or reopened) and keeps its owner and mitigation current. */
export function updateComplianceRisk(eventId: string, riskId: string, input: UpdateComplianceRiskInput): Promise<PrismComplianceRisk> {
  return complianceReviewRepository.updateRisk(eventId, riskId, parseContract(updateComplianceRiskSchema, input, "Compliance risk update"));
}
