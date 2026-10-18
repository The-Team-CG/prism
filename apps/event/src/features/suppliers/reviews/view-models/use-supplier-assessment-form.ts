import { useState } from "react";
import type { CreateSupplierReviewInput } from "@prism/types";
import {
  buildSupplierAssessmentInput,
  type SupplierAssessmentDimension,
  type SupplierAssessmentDraft,
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

export function useSupplierAssessmentForm({ supplierId, dimensions, initiallyCompleted, onAddReview }: UseSupplierAssessmentFormArgs) {
  const [draft, setDraft] = useState<SupplierAssessmentDraft>({ rating: "4", notes: "" });
  const [dimensionRatings, setDimensionRatings] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [idempotencyKey] = useState(newIdempotencyKey);

  const readiness = buildSupplierAssessmentInput({ draft, dimensionRatings, dimensions, idempotencyKey });

  async function submit() {
    if (completed || !readiness.ok) return;
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
    canSubmit: !completed && readiness.ok,
    missingDimensionNames: readiness.ok ? [] : readiness.missingDimensions.map((dimension) => dimension.name),
    validationMessage: readiness.ok ? null : readiness.message,
    updateDraft: (patch: Partial<SupplierAssessmentDraft>) => setDraft((current) => ({ ...current, ...patch })),
    updateDimension: (dimensionId: string, value: string) => setDimensionRatings((current) => ({ ...current, [dimensionId]: value })),
    submit,
  };
}
