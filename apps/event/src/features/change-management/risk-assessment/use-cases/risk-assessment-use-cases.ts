import { parseContract, recordEventRiskAssessmentSchema, type RecordEventRiskAssessmentInput, type RiskLevel } from "@prism/types";
import { riskAssessmentRepository } from "../data/risk-assessment-repository";
import { isLoweringRiskLevel } from "../model/risk-assessment-rules";

export function recordRiskAssessmentUseCase(eventId: string, draft: RecordEventRiskAssessmentInput, recordedLevel: RiskLevel | null) {
  if (isLoweringRiskLevel(recordedLevel, draft.level) && !draft.reason?.trim()) {
    throw new Error("Give a reason for lowering the event risk level.");
  }
  return riskAssessmentRepository.record(eventId, parseContract(recordEventRiskAssessmentSchema, draft, "Risk assessment"));
}
