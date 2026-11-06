import { describe, expect, it } from "vitest";
import { DEFAULT_MILESTONES, checkPaymentTerms } from "./payment-terms-form";

describe("checkPaymentTerms", () => {
  it("accepts the default 50/50 split without an override", () => {
    expect(checkPaymentTerms(DEFAULT_MILESTONES)).toEqual({
      schedule: [{ label: "Downpayment", percentage: 50 }, { label: "Balance", percentage: 50 }],
      total: 100,
      needsOverride: false,
      problem: null,
    });
  });

  it("allows up to three milestones that total 100 and a larger downpayment", () => {
    const check = checkPaymentTerms([
      { label: "Downpayment", percentage: "60" },
      { label: "Midpoint", percentage: "25.5" },
      { label: "Balance", percentage: "14.5" },
    ]);
    expect(check.problem).toBeNull();
    expect(check.needsOverride).toBe(false);
  });

  it("asks for a repeat-client override when the first milestone is under 50", () => {
    const check = checkPaymentTerms([{ label: "Downpayment", percentage: "30" }, { label: "Balance", percentage: "70" }]);
    expect(check).toMatchObject({ needsOverride: true, problem: null });
  });

  it.each([
    [[], "Add at least one payment milestone."],
    [[{ label: "A", percentage: "25" }, { label: "B", percentage: "25" }, { label: "C", percentage: "25" }, { label: "D", percentage: "25" }], "Use at most 3 milestones."],
    [[{ label: " ", percentage: "100" }], "Name every milestone."],
    [[{ label: "A", percentage: "" }, { label: "B", percentage: "100" }], "Each milestone needs a percentage above 0 and up to 100."],
    [[{ label: "A", percentage: "0" }, { label: "B", percentage: "100" }], "Each milestone needs a percentage above 0 and up to 100."],
    [[{ label: "A", percentage: "50" }, { label: "B", percentage: "40" }], "Milestones total 90%; they must total 100%."],
  ])("refuses %j with a plain reason", (rows, problem) => {
    expect(checkPaymentTerms(rows).problem).toBe(problem);
  });
});
