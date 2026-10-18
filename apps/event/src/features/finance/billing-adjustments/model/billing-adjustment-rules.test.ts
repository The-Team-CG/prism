import { describe, expect, it } from "vitest";
import {
  approvedBillingSources,
  blankReasonError,
  disputeAmountError,
  paymentWithinBalanceError,
} from "./billing-adjustment-rules";

describe("billing adjustment rules", () => {
  it("requires a non-blank reason before a waiver or dispute can be submitted", () => {
    expect(blankReasonError("   ", "Waiver reason")).toBe("Waiver reason is required.");
    expect(blankReasonError("Venue access was unavailable", "Waiver reason")).toBeNull();
  });

  it("caps a dispute at the statement total and rejects non-positive amounts", () => {
    const statement = { totalAmount: 100000 };
    expect(disputeAmountError(100001, statement)).toBe("Disputed amount cannot exceed the statement total.");
    expect(disputeAmountError(100000, statement)).toBeNull();
    expect(disputeAmountError(0, statement)).toMatch(/greater than zero/);
    expect(disputeAmountError(12.5, statement)).toMatch(/whole number/);
  });

  it("keeps partial payments within the remaining milestone balance", () => {
    expect(paymentWithinBalanceError(30000, 75000)).toBeNull();
    expect(paymentWithinBalanceError(75001, 75000)).toBe("Payment amount cannot exceed the remaining milestone balance.");
  });

  it("offers only approved billing sources for additional billing", () => {
    const sources = [
      { id: "bsrc_pending", status: "pending" },
      { id: "bsrc_approved", status: "approved" },
    ];
    expect(approvedBillingSources(sources).map((source) => source.id)).toEqual(["bsrc_approved"]);
  });
});
