import {
  changeSupplierTierSchema,
  createSupplierCertificationSchema,
  createSupplierReliabilityNoteSchema,
  createSupplierReviewSchema,
  createSupplierSchema,
  parseContract,
  promoteSupplierSchema,
  updateSupplierSchema,
  type CreateSupplierCertificationInput,
  type CreateSupplierInput,
  type CreateSupplierReliabilityNoteInput,
  type CreateSupplierReviewInput,
  type UpdateSupplierInput,
} from "@prism/types";
import { supplierDirectoryCommands } from "../data/supplier-directory-commands";
import { saveSupplierAction, type SupplierActionResult } from "./save-supplier-action";

export type SupplierActionDraft =
  | { kind: "create"; input: unknown }
  | { kind: "update"; supplierId: string; input: unknown }
  | { kind: "tier"; supplierId: string; input: unknown }
  | { kind: "review"; supplierId: string; input: unknown }
  | { kind: "reliability-note"; supplierId: string; input: unknown }
  | { kind: "promote"; supplierId: string; input: unknown }
  | { kind: "certification"; supplierId: string; input: unknown };

export type SupplierActionContext = {
  refresh: () => Promise<void>;
  eligibleReviewEventIds?: string[];
  eligiblePromotionEventIds?: string[];
};

function omitBlankFields(input: unknown, fieldNames: string[]) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  const normalized = { ...input } as Record<string, unknown>;
  for (const fieldName of fieldNames) {
    if (typeof normalized[fieldName] === "string" && !(normalized[fieldName] as string).trim()) delete normalized[fieldName];
  }
  return normalized;
}

function invalidAction(error: unknown): SupplierActionResult {
  return { saved: false, message: error instanceof Error ? error.message : "Supplier action is invalid." };
}

function hasEligibleEvent(eventId: unknown, eligibleEventIds: string[] | undefined) {
  return typeof eventId === "string" && Boolean(eventId) && Boolean(eligibleEventIds?.includes(eventId));
}

export async function submitSupplierAction(action: SupplierActionDraft, context: SupplierActionContext): Promise<SupplierActionResult> {
  try {
    switch (action.kind) {
      case "create": {
        const input = parseContract(createSupplierSchema, omitBlankFields(action.input, ["contactName", "email", "phone", "serviceInclusions", "performanceNotes"]), "Supplier");
        return saveSupplierAction(() => supplierDirectoryCommands.create(input as CreateSupplierInput), context.refresh);
      }
      case "update": {
        const input = parseContract(updateSupplierSchema, omitBlankFields(action.input, ["contactName", "email", "phone", "serviceInclusions", "performanceNotes"]), "Supplier profile");
        return saveSupplierAction(() => supplierDirectoryCommands.update(action.supplierId, input as UpdateSupplierInput), context.refresh);
      }
      case "tier": {
        const input = parseContract(changeSupplierTierSchema, action.input, "Supplier tier change");
        return saveSupplierAction(() => supplierDirectoryCommands.changeTier(action.supplierId, input), context.refresh);
      }
      case "review": {
        const input = parseContract(createSupplierReviewSchema, action.input, "Supplier review");
        if (!hasEligibleEvent(input.eventId, context.eligibleReviewEventIds)) return { saved: false, message: "Select an eligible completed event before submitting a review." };
        return saveSupplierAction(() => supplierDirectoryCommands.review(action.supplierId, input as CreateSupplierReviewInput), context.refresh);
      }
      case "reliability-note": {
        const input = parseContract(createSupplierReliabilityNoteSchema, action.input, "Reliability note");
        if (!hasEligibleEvent(input.eventId, context.eligibleReviewEventIds)) return { saved: false, message: "Select an eligible completed event before submitting a reliability note." };
        return saveSupplierAction(() => supplierDirectoryCommands.reliabilityNote(action.supplierId, input as CreateSupplierReliabilityNoteInput), context.refresh);
      }
      case "promote": {
        const input = parseContract(promoteSupplierSchema, action.input, "Supplier promotion");
        if (!hasEligibleEvent(input.eventId, context.eligiblePromotionEventIds)) return { saved: false, message: "Select an assessed completed event before promoting this supplier." };
        return saveSupplierAction(() => supplierDirectoryCommands.promote(action.supplierId, input), context.refresh);
      }
      case "certification": {
        const input = parseContract(createSupplierCertificationSchema, omitBlankFields(action.input, ["issuer", "expiresAt", "notes"]), "Certification metadata");
        return saveSupplierAction(() => supplierDirectoryCommands.certification(action.supplierId, input as CreateSupplierCertificationInput), context.refresh);
      }
      default:
        return { saved: false, message: "Supplier action is not supported." };
    }
  } catch (error) {
    return invalidAction(error);
  }
}
