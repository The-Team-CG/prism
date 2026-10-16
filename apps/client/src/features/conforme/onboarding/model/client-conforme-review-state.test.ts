import { describe, expect, it } from "vitest";
import {
  initialClientConformeReviewState,
  reduceClientConformeReviewState,
} from "./client-conforme-review-state";

describe("client conforme review state", () => {
  it("requires fresh consent when the reviewed execution changes", () => {
    const selectedFirst = reduceClientConformeReviewState(initialClientConformeReviewState, { type: "select-execution", executionId: "execution-v1" });
    const consented = reduceClientConformeReviewState(selectedFirst, { type: "set-consent", accepted: true });

    expect(reduceClientConformeReviewState(consented, { type: "select-execution", executionId: "execution-v2" }))
      .toEqual({ selectedExecutionId: "execution-v2", consentAccepted: false });
  });

  it("keeps the current consent only while the same execution remains selected", () => {
    const consented = { selectedExecutionId: "execution-v1", consentAccepted: true };
    expect(reduceClientConformeReviewState(consented, { type: "select-execution", executionId: "execution-v1" }))
      .toEqual({ selectedExecutionId: "execution-v1", consentAccepted: true });
  });
});
