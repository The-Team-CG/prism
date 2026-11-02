import { describe, expect, it } from "vitest";
import {
  isMilestoneSettled,
  isPaymentOverdue,
  paymentOverdueDays,
  parseRecordPaymentAmount,
  sortPaymentsByDueDate,
  sumPaymentAmounts,
} from "./finance-workspace-rules";

describe("finance-workspace-rules", () => {
  it("treats a milestone as settled once its status or remaining balance says nothing is left to collect", () => {
    expect(isMilestoneSettled({ status: "paid", remainingBalance: 0 })).toBe(true);
    expect(isMilestoneSettled({ status: "pending", remainingBalance: 0 })).toBe(true);
    expect(isMilestoneSettled({ status: "waived", remainingBalance: 120 })).toBe(true);
    expect(isMilestoneSettled({ status: "pending", remainingBalance: 260000 })).toBe(false);
  });

  it("detects overdue open payments", () => {
    const now = new Date("2026-07-17T00:00:00.000Z");
    expect(isPaymentOverdue("pending", "2026-07-01", now)).toBe(true);
    expect(isPaymentOverdue("paid", "2026-07-01", now)).toBe(false);
  });

  it("counts whole days past due on the Philippine calendar, matching the Inbox", () => {
    const now = new Date("2026-11-02T04:00:00.000Z");
    expect(paymentOverdueDays("pending", "2026-06-11", now)).toBe(144);
    expect(paymentOverdueDays("at_risk", "2026-11-03", now)).toBe(0);
    expect(paymentOverdueDays("paid", "2026-06-11", now)).toBe(0);
    expect(paymentOverdueDays("waived", "2026-06-11", now)).toBe(0);
  });

  it("orders milestones by due date with undated ones last", () => {
    const ordered = sortPaymentsByDueDate([
      { label: "Balance", dueDate: "2026-06-11" },
      { label: "Undated", dueDate: "" },
      { label: "Downpayment", dueDate: "2026-04-29" },
    ]);
    expect(ordered.map((payment) => payment.label)).toEqual(["Downpayment", "Balance", "Undated"]);
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
