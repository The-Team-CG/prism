import { describe, expect, it } from "vitest";
import {
  isPaymentOverdue,
  parseRecordPaymentAmount,
  sumPaymentAmounts,
} from "./finance-workspace-rules";

describe("finance-workspace-rules", () => {
  it("detects overdue open payments", () => {
    const now = new Date("2026-07-17T00:00:00.000Z");
    expect(isPaymentOverdue("pending", "2026-07-01", now)).toBe(true);
    expect(isPaymentOverdue("paid", "2026-07-01", now)).toBe(false);
  });

  it("sums payment totals", () => {
    const sums = sumPaymentAmounts([
      { amount: 100, amountPaid: 40, remainingBalance: 60, status: "partial" },
      { amount: 50, amountPaid: 50, remainingBalance: 0, status: "paid" },
    ]);
    expect(sums.totalDue).toBe(150);
    expect(sums.totalPaid).toBe(90);
    expect(sums.openMilestones).toBe(1);
  });

  it("parses payment amount input", () => {
    expect(parseRecordPaymentAmount("12.5")).toBe(12.5);
    expect(parseRecordPaymentAmount("x")).toBe(0);
  });
});
