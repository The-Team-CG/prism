import type { PrismFileRequirementItem } from "@prism/types";
import { createFileRequirementSchema, parseContract, updateFileRequirementSchema } from "@prism/types";
import { fileRequirementsMatrixRepository } from "../data/file-requirements-matrix-repository";
import {
  buildFileRequirementCreate,
  buildFileRequirementUpdate,
  type FileRequirementDraft,
} from "../model/file-requirements-matrix-rules";

/** Saves PMCM edits to a derived or custom requirement. Resolves null when nothing changed. */
export async function updateFileRequirement(eventId: string, item: PrismFileRequirementItem, draft: FileRequirementDraft) {
  const changes = buildFileRequirementUpdate(item, draft);
  if (!changes) return null;
  const input = parseContract(updateFileRequirementSchema, changes, "File requirement update");
  return fileRequirementsMatrixRepository.update(eventId, item.key, input);
}

/** Adds a PMCM custom requirement after validating the draft against the shared contract. */
export function createFileRequirement(eventId: string, draft: FileRequirementDraft) {
  const input = parseContract(createFileRequirementSchema, buildFileRequirementCreate(draft), "File requirement");
  return fileRequirementsMatrixRepository.create(eventId, input);
}
