import { describe, expect, it } from "vitest";
import { clientPaymentLines, overduePaymentCount } from "./client-billing-rules";

describe("client-billing-rules", () => {
  it("shows a payment PMCM undid as reversed, without a receipt, a negative amount or a second line for the reversal", () => {
    const record = (id: string, amountReceived: number, extra: Record<string, unknown> = {}) =>
      ({ id, eventId: "e1", milestoneId: "m1", amountReceived, paymentDate: "2026-05-30", paymentMethod: "bank", referenceNumber: id, recordedAt: "2026-05-30", ...extra });
    const history = [record("r1", 100), record("rev1", -100, { reversesRecordId: "r1" }), record("r2", 60)];

    expect(clientPaymentLines(history).map(({ record: line, reversed }) => [line.id, reversed])).toEqual([["r1", true], ["r2", false]]);
  });

  it("counts payments still owed past their due date for the Billing badge, across events or for one", () => {
    const payments = [
      { eventId: "a", dueDate: "2026-10-19", remainingBalance: 66000 },
      { eventId: "a", dueDate: "2026-11-20", remainingBalance: 84000 },
      { eventId: "b", dueDate: "2026-10-15T00:00:00.000Z", remainingBalance: 125000 },
      { eventId: "b", dueDate: "2026-09-01", remainingBalance: 0 },
      { eventId: "b", dueDate: "2026-09-01", remainingBalance: 5000, supersededAt: "2026-09-10" },
    ];
    expect(overduePaymentCount(payments, "2026-11-14")).toBe(2);
    expect(overduePaymentCount(payments, "2026-11-14", "a")).toBe(1);
  });
});
