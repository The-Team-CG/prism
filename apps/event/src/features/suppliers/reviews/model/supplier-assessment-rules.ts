import { createSupplierReviewSchema, type CreateSupplierReviewInput } from "@prism/types";

export type SupplierAssessmentDraft = { rating: string; notes: string };
export type SupplierAssessmentDimension = { id: string; name: string };

export type SupplierAssessmentReadiness =
  | { ok: true; input: CreateSupplierReviewInput }
  | { ok: false; missingDimensions: SupplierAssessmentDimension[]; message: string | null };

/**
 * A PMCM event assessment is complete only when the overall rating, notes and every active
 * category dimension are rated. The same contract is validated by createSupplierReviewSchema.
 */
export function buildSupplierAssessmentInput(args: {
  draft: SupplierAssessmentDraft;
  dimensionRatings: Readonly<Record<string, string>>;
  dimensions: readonly SupplierAssessmentDimension[];
  idempotencyKey: string;
}): SupplierAssessmentReadiness {
  const missingDimensions = args.dimensions.filter((dimension) => !args.dimensionRatings[dimension.id]);
  if (missingDimensions.length > 0) {
    return { ok: false, missingDimensions, message: null };
  }

  const parsed = createSupplierReviewSchema.safeParse({
    rating: Number(args.draft.rating),
    notes: args.draft.notes,
    dimensionRatings: args.dimensions.length > 0
      ? args.dimensions.map((dimension) => ({ dimensionId: dimension.id, rating: Number(args.dimensionRatings[dimension.id]) }))
      : undefined,
    idempotencyKey: args.idempotencyKey,
  });
  if (!parsed.success) {
    return { ok: false, missingDimensions: [], message: parsed.error.issues[0]?.message ?? "Review is incomplete" };
  }
  return { ok: true, input: parsed.data };
}
