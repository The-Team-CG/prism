import { describe, expect, it } from "vitest";
import { parseRecordPaymentAmount } from "./finance-workspace-rules";

describe("finance-workspace-rules", () => {
  it("parses payment amount input", () => {
    expect(parseRecordPaymentAmount("12.5")).toBe(12.5);
    expect(parseRecordPaymentAmount("x")).toBe(0);
  });
});
