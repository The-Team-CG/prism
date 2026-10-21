import { describe, expect, it } from "vitest";
import { buildSupplierAssessmentInput, describeSupplierAssessment } from "./supplier-assessment-rules";

const dimensions = [
  { id: "dim_reliability", name: "Reliability" },
  { id: "dim_punctuality", name: "Punctuality" },
];

describe("supplier assessment readiness shared by the closure and directory panels", () => {
  it("describes the missing dimensions and blocks submit until every dimension is rated", () => {
    const partial = describeSupplierAssessment(buildSupplierAssessmentInput({
      draft: { rating: "4", notes: "Good" },
      dimensionRatings: { dim_reliability: "5" },
      dimensions,
    }));
    expect(partial).toEqual({ canSubmit: false, missingDimensionNames: ["Punctuality"], validationMessage: null });

    const complete = describeSupplierAssessment(buildSupplierAssessmentInput({
      draft: { rating: "4", notes: "Good" },
      dimensionRatings: { dim_reliability: "5", dim_punctuality: "3" },
      dimensions,
    }));
    expect(complete).toEqual({ canSubmit: true, missingDimensionNames: [], validationMessage: null });
  });

  it("blocks submit with a validation message when the notes are empty despite complete dimensions", () => {
    const state = describeSupplierAssessment(buildSupplierAssessmentInput({
      draft: { rating: "4", notes: "   " },
      dimensionRatings: { dim_reliability: "5", dim_punctuality: "3" },
      dimensions,
    }));
    expect(state.canSubmit).toBe(false);
    expect(state.validationMessage).toEqual(expect.any(String));
  });

  it("builds the schema-valid payload with all dimension ratings for submit", () => {
    const readiness = buildSupplierAssessmentInput({
      draft: { rating: "2", notes: "Late load-in" },
      dimensionRatings: { dim_reliability: "4", dim_punctuality: "1" },
      dimensions,
      idempotencyKey: "key-1",
    });
    expect(readiness).toEqual({
      ok: true,
      input: {
        rating: 2,
        notes: "Late load-in",
        dimensionRatings: [
          { dimensionId: "dim_reliability", rating: 4 },
          { dimensionId: "dim_punctuality", rating: 1 },
        ],
        idempotencyKey: "key-1",
      },
    });
  });
});
