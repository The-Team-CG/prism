import type { PrismFileRequirementItem, PrismStoredObject } from "@prism/types";

export type ClientDocumentChecklistRow = {
  requirement: PrismFileRequirementItem;
  /** The stored file that currently fulfils this requirement, when the client can see it. */
  file?: PrismStoredObject;
  /** The client provides this record by uploading a file here. */
  uploadable: boolean;
  /** The client still needs to provide or replace this record. */
  needsClient: boolean;
};

export type ClientDocumentChecklist = {
  rows: ClientDocumentChecklistRow[];
  /** Uploads not linked to any requirement: shared by PMCM, or sent without choosing a requirement. */
  otherFiles: PrismStoredObject[];
};

const DONE: ReadonlySet<string> = new Set(["submitted", "generated", "approved", "complete"]);

export function isClientUploadableRequirement(item: PrismFileRequirementItem) {
  return item.origin === "custom" && item.ownerRole === "client";
}

/**
 * One list that answers "what is needed, what did I send, and has PMCM reviewed it": each requirement
 * carries its linked upload, client-owned open items come first, and unlinked files are kept apart.
 */
export function buildClientDocumentChecklist(requirements: PrismFileRequirementItem[], files: PrismStoredObject[]): ClientDocumentChecklist {
  const byId = new Map(files.map((file) => [file.id, file]));
  const linked = new Set<string>();
  const rows = requirements.map((requirement) => {
    const file = requirement.uploadedObjectId ? byId.get(requirement.uploadedObjectId) : undefined;
    if (file) linked.add(file.id);
    const uploadable = isClientUploadableRequirement(requirement);
    const rejected = requirement.validationStatus === "rejected";
    return { requirement, file, uploadable, needsClient: uploadable && (rejected || !DONE.has(requirement.status)) };
  });
  rows.sort((left, right) => Number(right.needsClient) - Number(left.needsClient) || Number(left.requirement.overdue === false) - Number(right.requirement.overdue === false));
  return { rows, otherFiles: files.filter((file) => !linked.has(file.id)) };
}

/** Plain-language review state for a requirement row. */
export function clientRequirementReviewLabel(row: ClientDocumentChecklistRow): string {
  const { requirement } = row;
  if (requirement.validationStatus === "rejected") return "Not accepted. Upload a replacement";
  if (requirement.status === "approved" || requirement.status === "complete") return "Approved by PMCM";
  if (requirement.status === "submitted") return "Sent, waiting for PMCM review";
  if (requirement.status === "generated") return "Prepared by PMCM";
  if (requirement.status === "pending") return "In progress";
  return row.uploadable ? "Not uploaded yet" : "Not available yet";
}
