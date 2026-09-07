import { describe, expect, it } from "vitest";
import { clientBillingSummary, clientMilestoneFollowUpCopy, clientMilestoneRemaining } from "./client-billing-rules";

describe("client-billing-rules", () => {
  it("reconciles paid and remaining across partially paid milestones", () => {
    expect(clientBillingSummary([
      { id: "m1", eventId: "e1", label: "Deposit", percentage: 66.67, amount: 100000, amountPaid: 40000, remainingBalance: 60000, dueDate: "2026-06-01", status: "partial", history: [] },
      { id: "m2", eventId: "e1", label: "Balance", percentage: 33.33, amount: 50000, amountPaid: 0, remainingBalance: 50000, dueDate: "2026-06-18", status: "pending", history: [] },
    ], { totalAmount: 150000 })).toEqual({ totalAmount: 150000, totalPaid: 40000, balance: 110000 });
  });
  it("prefers remainingBalance and explains unpaid follow-up", () => {
    expect(clientMilestoneRemaining({ amount: 100, amountPaid: 40, remainingBalance: 60 })).toBe(60);
    expect(clientMilestoneRemaining({ amount: 100, amountPaid: 25 })).toBe(75);
    expect(clientMilestoneFollowUpCopy(0)).toBe("This milestone is settled.");
    expect(clientMilestoneFollowUpCopy(10)).toMatch(/Remaining balance/);
  });
});
