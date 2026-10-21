import { createComplianceRiskSchema, parseContract, type CreateComplianceRiskInput, type PrismComplianceRisk } from "@prism/types";
import { complianceReviewRepository } from "../data/compliance-review-repository";

export function createComplianceRisk(eventId: string, input: CreateComplianceRiskInput): Promise<PrismComplianceRisk> {
  return complianceReviewRepository.createRisk(eventId, parseContract(createComplianceRiskSchema, input, "Compliance risk"));
}
