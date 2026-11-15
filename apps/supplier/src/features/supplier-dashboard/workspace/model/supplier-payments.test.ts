import { describe, expect, it } from "vitest";
import type { PrismSupplierPayableMilestone } from "@prism/types";
import { newPayoutReleases, payoutStep, supplierBookings, supplierPaymentTotals } from "./supplier-payments";

const TODAY = "2026-11-14";

function payable(overrides: Partial<PrismSupplierPayableMilestone>): PrismSupplierPayableMilestone {
  return {
    id: "p", eventId: "evt", requestId: "req", quoteId: "q", label: "Downpayment", amount: 100000, dueDate: "2026-12-30T08:00:00.000Z",
    status: "scheduled", amountReleased: 0, remainingBalance: 100000, history: [], createdAt: "2026-11-01T00:00:00.000Z", ...overrides,
  };
}

const release = (paymentDate: string, amount: number) => ({ id: paymentDate, milestoneId: "p", kind: "release" as const, amount, paymentDate, method: "Bank Transfer", referenceNumber: "", notes: null, reversesRecordId: null, recordedAt: paymentDate });

describe("supplier payments", () => {
  it.each([
    ["paid out", payable({ amountReleased: 100000, remainingBalance: 0, history: [release("2026-11-01T08:00:00.000Z", 100000)] }), "paid", "Paid Nov 1, 2026"],
    ["late", payable({ dueDate: "2026-11-09T08:00:00.000Z" }), "overdue", "Due Nov 9, 2026 · 5 days late"],
    ["due within a week", payable({ dueDate: "2026-11-16T08:00:00.000Z", amountReleased: 50000, remainingBalance: 50000 }), "due-soon", "Due Nov 16, 2026 · in 2 days"],
    ["later", payable({}), "upcoming", "Due Dec 30, 2026"],
  ])("reads a payout that is %s", (_name, item, state, when) => {
    expect(payoutStep(item, TODAY)).toMatchObject({ state, when });
  });

  it("adds up what was paid, what is still to come, what is late, and names the next payment", () => {
    const totals = supplierPaymentTotals([
      payable({ id: "a", amountReleased: 242500, remainingBalance: 0, amount: 242500 }),
      payable({ id: "b", dueDate: "2026-11-09T08:00:00.000Z", amount: 90000, remainingBalance: 90000 }),
      payable({ id: "c", label: "Second payment", dueDate: "2026-11-16T08:00:00.000Z", amount: 145500, amountReleased: 50000, remainingBalance: 95500 }),
    ], TODAY);

    expect(totals).toMatchObject({ paid: 292500, toCome: 185500, late: 90000 });
    expect(totals.next?.id).toBe("c");
  });

  it("names each booking by its event, and lists a won booking whose schedule PMCM has not set yet", () => {
    const bookings = supplierBookings({
      payables: [payable({ requestId: "req_1" })],
      selectedQuotes: [{ id: "q1", requestId: "req_1", amount: 485000, paymentTerms: "50/30/20" }, { id: "q2", requestId: "req_2", amount: 90000, paymentTerms: "" }] as never,
      quoteRequests: [{ id: "req_1", category: "Registration" }, { id: "req_2", category: "Florals" }] as never,
      readinessBoard: { items: [{ requestId: "req_1", eventName: "Operations Booking" }] } as never,
    });

    expect(bookings.map((booking) => [booking.eventName, booking.contract, booking.payables.length])).toEqual([["Operations Booking", 485000, 1], ["Florals", 90000, 0]]);
  });

  it("marks payouts sent since the last visit as new, and without a visit only those from the last two weeks", () => {
    const sent = (id: string, recordedAt: string) => ({ ...release(recordedAt, 1000), id, recordedAt });
    const payables = [payable({ history: [sent("old", "2026-10-01T00:00:00.000Z"), sent("recent", "2026-11-12T00:00:00.000Z"), { ...sent("undo", "2026-11-13T00:00:00.000Z"), kind: "reversal" as const }] })];
    const now = new Date("2026-11-14T00:00:00.000Z");

    expect([...newPayoutReleases(payables, "2026-11-10T00:00:00.000Z", now)]).toEqual(["recent"]);
    expect([...newPayoutReleases(payables, null, now)]).toEqual(["recent"]);
    expect(newPayoutReleases(payables, "2026-11-13T00:00:00.000Z", now).size).toBe(0);
  });
});
