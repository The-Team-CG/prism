import { parseContract, upsertFileRequirementTemplateSchema, type UpsertFileRequirementTemplateInput } from "@prism/types";
import { fileRequirementsMatrixRepository } from "../data/file-requirements-matrix-repository";

export function loadFileRequirementTemplates() {
  return fileRequirementsMatrixRepository.listTemplates();
}

export function saveFileRequirementTemplate(input: UpsertFileRequirementTemplateInput) {
  return fileRequirementsMatrixRepository.saveTemplate(parseContract(upsertFileRequirementTemplateSchema, input, "File requirement template"));
}

export function applyFileRequirementTemplate(eventId: string) {
  return fileRequirementsMatrixRepository.applyTemplate(eventId);
}
