import { describe, expect, it } from "vitest";
import type { PrismPaymentReceipt } from "@prism/types";
import { filterToQuery, parsePesos, receiptActions, receiptNotes, receiptOutcomes, totalUnapplied } from "./receipt-rules";

function receipt(overrides: Partial<PrismPaymentReceipt> = {}): PrismPaymentReceipt {
  return {
    id: "prcp_1", amount: 50000, receivedDate: "2026-11-10", method: "Bank Transfer", referenceNumber: "BDO-1", payerName: "Ana Reyes",
    eventId: null, notes: "", status: "recorded", legacy: false, evidenceObjectId: null, verifiedAt: null, verifiedBy: null,
    verificationNotes: null, rejectionReason: null, reversalReason: null, possibleDuplicateOfId: null, applied: 0, refunded: 0,
    unapplied: 50000, allocations: [], refunds: [], recordedBy: "PMCM", recordedAt: "2026-11-10T01:00:00.000Z", ...overrides,
  };
}
const slice = (reversed: boolean) => ({ id: "payrec_1", eventId: "evt_1", milestoneId: "m1", milestoneLabel: "Deposit", amount: 20000, reversed, reversalId: reversed ? "payrec_2" : null, reversalReason: null, recordedAt: "2026-11-10T02:00:00.000Z" });

describe("receipt rules", () => {
  it("reads whole pesos with thousands separators and refuses everything else", () => {
    expect(parsePesos("1,200")).toBe(1200);
    expect(parsePesos(" 50000 ")).toBe(50000);
    for (const bad of ["", "0", "-5", "12.50", "12.0", "abc", "1e3", "9007199254740993"]) expect(parsePesos(bad)).toBeNull();
  });

  it("asks the server for unapplied funds with its own flag and for a status with the status", () => {
    expect(filterToQuery("unapplied")).toEqual({ unapplied: true });
    expect(filterToQuery("all")).toEqual({});
    expect(filterToQuery("verified")).toEqual({ status: "verified" });
  });

  it("offers each action only where the ledger would accept it", () => {
    expect(receiptActions(receipt())).toEqual({ allocate: true, refund: true, verify: true, reject: true, reverse: true });
    // Applied in part: it can no longer be called not-arrived, only reversed; what is left can still move.
    expect(receiptActions(receipt({ applied: 20000, unapplied: 30000, allocations: [slice(false)] }))).toEqual({ allocate: true, refund: true, verify: true, reject: false, reverse: true });
    // Everything applied: nothing left to apply or pay back.
    expect(receiptActions(receipt({ status: "verified", applied: 50000, unapplied: 0, allocations: [slice(false)] }))).toEqual({ allocate: false, refund: false, verify: false, reject: false, reverse: true });
    // A reversed allocation no longer blocks rejecting.
    expect(receiptActions(receipt({ allocations: [slice(true)] })).reject).toBe(true);
    // Part of it was paid back: it cannot be said never to have arrived.
    expect(receiptActions(receipt({ refunded: 10000, unapplied: 40000 })).reverse).toBe(false);
    // A receipt that stopped counting offers nothing.
    for (const status of ["rejected", "reversed"] as const) {
      expect(receiptActions(receipt({ status, unapplied: 0 }))).toEqual({ allocate: false, refund: false, verify: false, reject: false, reverse: false });
    }
  });

  it("totals only the unapplied money on receipts that still count", () => {
    expect(totalUnapplied([receipt(), receipt({ status: "verified", unapplied: 1000 }), receipt({ status: "reversed", unapplied: 0 }), receipt({ status: "rejected", unapplied: 999 })])).toBe(51000);
  });

  it("shows every outcome that was recorded, so a verified receipt that later bounced still says why", () => {
    expect(receiptOutcomes(receipt())).toEqual([]);
    expect(receiptOutcomes(receipt({ status: "verified", verificationNotes: "Matches the BDO line" }))).toEqual(["Verified: Matches the BDO line"]);
    expect(receiptOutcomes(receipt({ status: "reversed", verificationNotes: "Matches the BDO line", reversalReason: "Cheque bounced" }))).toEqual(["Verified: Matches the BDO line", "Reversed: Cheque bounced"]);
    expect(receiptOutcomes(receipt({ status: "rejected", rejectionReason: "No such transfer" }))).toEqual(["Rejected: No such transfer"]);
  });

  it("flags what deserves a second look", () => {
    expect(receiptNotes(receipt())).toEqual(["Not yet checked against the bank or wallet statement."]);
    expect(receiptNotes(receipt({ legacy: true }))).toEqual(["Carried over from a payment recorded before receipts existed. No evidence is on file."]);
    expect(receiptNotes(receipt({ status: "verified", possibleDuplicateOfId: "prcp_0" }))).toEqual(["Same amount, method, day and payer as another receipt. Check it is not a double entry."]);
    expect(receiptNotes(receipt({ status: "verified" }))).toEqual([]);
  });
});
