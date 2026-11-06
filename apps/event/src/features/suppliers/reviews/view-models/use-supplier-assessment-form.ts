import { useState } from "react";
import type { CreateSupplierReviewInput } from "@prism/types";
import {
  buildSupplierAssessmentInput,
  describeSupplierAssessment,
  type SupplierAssessmentDimension,
  type SupplierAssessmentDraft,
  type SupplierAssessmentReadiness,
} from "../model/supplier-assessment-rules";

export type UseSupplierAssessmentFormArgs = {
  supplierId: string;
  dimensions: readonly SupplierAssessmentDimension[];
  initiallyCompleted: boolean;
  onAddReview: (supplierId: string, input: CreateSupplierReviewInput) => Promise<boolean>;
};

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `supplier-review-${Date.now()}`;
}

/** Plain copy for the first thing blocking a save. Raw schema messages are for the API, not the reviewer. */
function blockedSaveMessage(draft: SupplierAssessmentDraft, readiness: SupplierAssessmentReadiness): string | null {
  if (readiness.ok) return null;
  if (!draft.notes.trim()) return "Add a note before saving this review.";
  if (readiness.missingDimensions.length > 0) return null;
  return "Check the review before saving.";
}

export function useSupplierAssessmentForm({ supplierId, dimensions, initiallyCompleted, onAddReview }: UseSupplierAssessmentFormArgs) {
  const [draft, setDraft] = useState<SupplierAssessmentDraft>({ rating: "4", notes: "" });
  const [dimensionRatings, setDimensionRatings] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(initiallyCompleted);
  // Gaps are shown only after the reviewer tries to save, so a fresh form does not open with errors.
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [idempotencyKey] = useState(newIdempotencyKey);

  const readiness = buildSupplierAssessmentInput({ draft, dimensionRatings, dimensions, idempotencyKey });
  const display = describeSupplierAssessment(readiness);

  async function submit() {
    if (completed) return;
    if (!readiness.ok) {
      setSaveAttempted(true);
      return;
    }
    try {
      const saved = await onAddReview(supplierId, readiness.input);
      if (saved) setCompleted(true);
    } catch {
      // The dashboard adapter owns the shared error channel; keep the draft editable.
    }
  }

  return {
    draft,
    dimensionRatings,
    completed,
    // Enabled until saved, so pressing it is what reveals what is missing.
    canSubmit: !completed,
    missingDimensionNames: saveAttempted ? display.missingDimensionNames : [],
    validationMessage: saveAttempted ? blockedSaveMessage(draft, readiness) : null,
    updateDraft: (patch: Partial<SupplierAssessmentDraft>) => setDraft((current) => ({ ...current, ...patch })),
    updateDimension: (dimensionId: string, value: string) => setDimensionRatings((current) => ({ ...current, [dimensionId]: value })),
    submit,
  };
}
