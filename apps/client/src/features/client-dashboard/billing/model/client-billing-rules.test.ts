import { describe, expect, it } from "vitest";
import { clientBillingSummary, clientMilestoneFollowUpCopy, clientMilestoneRemaining, portalBillingRows } from "./client-billing-rules";

describe("client-billing-rules", () => {
  it("lists each account billing view from its own records", () => {
    const source = {
      events: [{ id: "e1", eventName: "Summit" }, { id: "e2", eventName: "Gala" }],
      payments: [
        { id: "m1", eventId: "e1", label: "Deposit", amount: 100, amountPaid: 100, remainingBalance: 0, dueDate: "2026-06-01", status: "paid", supersededAt: null, history: [{ id: "r1", eventId: "e1", milestoneId: "m1", amountReceived: 100, paymentDate: "2026-05-30", paymentMethod: "bank", referenceNumber: "R-1", recordedAt: "2026-05-30" }] },
        { id: "m2", eventId: "e1", label: "Balance", amount: 300, amountPaid: 0, remainingBalance: 300, dueDate: "2026-11-30", status: "pending", supersededAt: null, history: [] },
        { id: "m3", eventId: "e2", label: "Deposit", amount: 50, amountPaid: 0, remainingBalance: 50, dueDate: "2026-10-01", status: "pending", supersededAt: null, history: [] },
        { id: "old", eventId: "e2", label: "Replaced", amount: 10, amountPaid: 0, remainingBalance: 10, dueDate: "2026-09-01", status: "pending", supersededAt: "2026-08-01", history: [] },
      ],
      statements: [{ eventId: "e1", number: "B-1", status: "issued", totalAmount: 400, eventDate: "2026-12-10" }],
    };
    const titles = (view: string) => portalBillingRows(view, source)?.map((row) => row.title);

    expect(portalBillingRows("billing-overview", source)).toBeNull();
    expect(titles("billing-payment-schedule")).toEqual(["Deposit", "Deposit", "Balance"]);
    expect(titles("dashboard-payment-reminders")).toEqual(["Deposit", "Balance"]);
    expect(titles("billing-receipts")).toEqual(["Deposit received"]);
    expect(portalBillingRows("billing-balance", source)?.map((row) => [row.eventName, row.amount])).toEqual([
      ["Summit", 300],
      ["Gala", 50],
    ]);
    expect(titles("billing-invoices")).toEqual(["Statement B-1"]);
  });

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
