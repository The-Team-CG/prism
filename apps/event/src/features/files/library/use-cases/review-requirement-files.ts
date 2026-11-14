import { parseContract, reviewRequirementFileSchema } from "@prism/types";
import { fileRequirementsMatrixRepository } from "../../matrix/data/file-requirements-matrix-repository";
import type { PmcmReviewEntry } from "../model/pmcm-file-library";

export function reviewRequirementFile(eventId: string, entry: Pick<PmcmReviewEntry, "key" | "documentId">, decision: "approve" | "reject", reason = "") {
  const input = parseContract(reviewRequirementFileSchema, { documentId: entry.documentId, decision, ...(decision === "reject" ? { reason } : {}) }, "Review");
  return fileRequirementsMatrixRepository.review(eventId, entry.key, input);
}

/**
 * Approves several files one after another, so each keeps its own check that it is still the file waiting. Returns the
 * names of any that could not be approved (for example, a newer upload arrived), so PMCM can look at those.
 */
export async function approveRequirementFiles(eventId: string, entries: PmcmReviewEntry[]) {
  const failed: string[] = [];
  // Sequential on purpose: each approval re-reads the requirement, and the list is the few files PMCM picked.
  for (const entry of entries) {
    try {
      await reviewRequirementFile(eventId, entry, "approve");
    } catch {
      failed.push(entry.fileName);
    }
  }
  return failed;
}
