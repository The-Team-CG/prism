/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import type { CreateSupplierReviewInput } from "@prism/types";
import { describe, expect, it, vi } from "vitest";
import { useSupplierAssessmentForm } from "./use-supplier-assessment-form";

const dimensions = [
  { id: "dim_reliability", name: "Reliability" },
  { id: "dim_punctuality", name: "Punctuality" },
];

function renderAssessment(overrides: Partial<Omit<Parameters<typeof useSupplierAssessmentForm>[0], "onAddReview">> & {
  onAddReview?: (supplierId: string, input: CreateSupplierReviewInput) => Promise<boolean>;
} = {}) {
  const onAddReview = overrides.onAddReview ?? vi.fn(async (_supplierId: string, _input: CreateSupplierReviewInput) => true);
  const hook = renderHook(() => useSupplierAssessmentForm({
    supplierId: "sup_1",
    dimensions,
    initiallyCompleted: false,
    ...overrides,
    onAddReview,
  }));
  return { ...hook, onAddReview: onAddReview as ReturnType<typeof vi.fn> };
}

describe("useSupplierAssessmentForm", () => {
  it("keeps submission blocked until every dimension and the notes are complete", () => {
    const { result } = renderAssessment();

    act(() => result.current.updateDraft({ notes: "Solid run of show" }));
    expect(result.current.canSubmit).toBe(false);
    expect(result.current.missingDimensionNames).toEqual(["Reliability", "Punctuality"]);

    act(() => result.current.updateDimension("dim_reliability", "5"));
    expect(result.current.missingDimensionNames).toEqual(["Punctuality"]);
    expect(result.current.canSubmit).toBe(false);

    act(() => result.current.updateDimension("dim_punctuality", "4"));
    expect(result.current.canSubmit).toBe(true);
    expect(result.current.validationMessage).toBeNull();
  });

  it("submits the schema-valid assessment with one idempotency key and marks it saved", async () => {
    const { result, onAddReview } = renderAssessment();

    act(() => {
      result.current.updateDraft({ rating: "3", notes: "Recovered well after the delay" });
      result.current.updateDimension("dim_reliability", "4");
      result.current.updateDimension("dim_punctuality", "2");
    });
    await act(async () => { await result.current.submit(); });

    expect(onAddReview).toHaveBeenCalledTimes(1);
    const [supplierId, input] = onAddReview.mock.calls[0] as [string, CreateSupplierReviewInput];
    expect(supplierId).toBe("sup_1");
    expect(input).toMatchObject({
      rating: 3,
      notes: "Recovered well after the delay",
      dimensionRatings: [
        { dimensionId: "dim_reliability", rating: 4 },
        { dimensionId: "dim_punctuality", rating: 2 },
      ],
    });
    expect(input.idempotencyKey).toEqual(expect.any(String));
    expect(result.current.completed).toBe(true);
    expect(result.current.canSubmit).toBe(false);
  });

  it("keeps the draft editable and submittable after a failed save", async () => {
    const { result, onAddReview } = renderAssessment({ onAddReview: vi.fn(async () => false) });

    act(() => {
      result.current.updateDraft({ notes: "Retry me" });
      result.current.updateDimension("dim_reliability", "5");
      result.current.updateDimension("dim_punctuality", "5");
    });
    await act(async () => { await result.current.submit(); });

    expect(result.current.completed).toBe(false);
    expect(result.current.canSubmit).toBe(true);
    expect(onAddReview).toHaveBeenCalledTimes(1);
  });

  it("starts completed when the assessment already exists and never resubmits", async () => {
    const { result, onAddReview } = renderAssessment({ initiallyCompleted: true });

    expect(result.current.completed).toBe(true);
    expect(result.current.canSubmit).toBe(false);
    await act(async () => { await result.current.submit(); });
    expect(onAddReview).not.toHaveBeenCalled();
  });
});
