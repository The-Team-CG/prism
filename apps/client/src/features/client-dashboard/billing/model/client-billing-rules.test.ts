import { describe, expect, it } from "vitest";
import { clientBillingSummary, clientMilestoneFollowUpCopy, clientMilestoneRemaining, clientPaymentLines, portalBillingRows } from "./client-billing-rules";

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
    expect(titles("billing-statements")).toEqual(["Statement B-1"]);
  });

  it("shows a payment PMCM undid as reversed, without a receipt, a negative amount or a second line for the reversal", () => {
    const record = (id: string, amountReceived: number, extra: Record<string, unknown> = {}) =>
      ({ id, eventId: "e1", milestoneId: "m1", amountReceived, paymentDate: "2026-05-30", paymentMethod: "bank", referenceNumber: id, recordedAt: "2026-05-30", ...extra });
    const history = [record("r1", 100), record("rev1", -100, { reversesRecordId: "r1" }), record("r2", 60)];

    expect(clientPaymentLines(history).map(({ record: line, reversed }) => [line.id, reversed])).toEqual([["r1", true], ["r2", false]]);

    const source = {
      events: [{ id: "e1", eventName: "Summit" }],
      payments: [{ id: "m1", eventId: "e1", label: "Deposit", amount: 100, amountPaid: 60, remainingBalance: 40, dueDate: "2026-06-01", status: "partially_paid", supersededAt: null, history }],
      statements: [],
    };
    expect(portalBillingRows("billing-receipts", source)?.map((row) => [row.id, row.amount])).toEqual([["r2", 60]]);
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
