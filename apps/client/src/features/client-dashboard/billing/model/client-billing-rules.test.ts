import { describe, expect, it } from "vitest";
import { clientPaymentLines } from "./client-billing-rules";

describe("client-billing-rules", () => {
  it("shows a payment PMCM undid as reversed, without a receipt, a negative amount or a second line for the reversal", () => {
    const record = (id: string, amountReceived: number, extra: Record<string, unknown> = {}) =>
      ({ id, eventId: "e1", milestoneId: "m1", amountReceived, paymentDate: "2026-05-30", paymentMethod: "bank", referenceNumber: id, recordedAt: "2026-05-30", ...extra });
    const history = [record("r1", 100), record("rev1", -100, { reversesRecordId: "r1" }), record("r2", 60)];

    expect(clientPaymentLines(history).map(({ record: line, reversed }) => [line.id, reversed])).toEqual([["r1", true], ["r2", false]]);
  });
});
