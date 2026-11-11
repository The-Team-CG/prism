import { describe, expect, it } from "vitest";
import type { PrismPaymentReceipt } from "@prism/types";
import { evidenceProblem, fileSizeLabel, filterToQuery, parsePesos, receiptActions, receiptNotes, receiptOutcomes, totalUnapplied } from "./receipt-rules";

function receipt(overrides: Partial<PrismPaymentReceipt> = {}): PrismPaymentReceipt {
  return {
    id: "prcp_1", amount: 50000, receivedDate: "2026-11-10", method: "Bank Transfer", referenceNumber: "BDO-1", payerName: "Ana Reyes",
    eventId: null, notes: "", status: "recorded", legacy: false, evidenceObjectId: null, evidence: null, verifiedAt: null, verifiedBy: null,
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
    expect(receiptActions(receipt())).toEqual({ allocate: true, refund: true, verify: true, reject: true, reverse: true, attachEvidence: false, earmark: true });
    // Applied in part: it can no longer be called not-arrived, only reversed; what is left can still move.
    expect(receiptActions(receipt({ applied: 20000, unapplied: 30000, allocations: [slice(false)] }))).toEqual({ allocate: true, refund: true, verify: true, reject: false, reverse: true, attachEvidence: false, earmark: true });
    // Everything applied: nothing left to apply or pay back.
    expect(receiptActions(receipt({ status: "verified", applied: 50000, unapplied: 0, allocations: [slice(false)] }))).toEqual({ allocate: false, refund: false, verify: false, reject: false, reverse: true, attachEvidence: false, earmark: true });
    // A reversed allocation no longer blocks rejecting.
    expect(receiptActions(receipt({ allocations: [slice(true)] })).reject).toBe(true);
    // Part of it was paid back: it cannot be said never to have arrived.
    expect(receiptActions(receipt({ refunded: 10000, unapplied: 40000 })).reverse).toBe(false);
    // A receipt that stopped counting offers nothing.
    for (const status of ["rejected", "reversed"] as const) {
      expect(receiptActions(receipt({ status, unapplied: 0 }))).toEqual({ allocate: false, refund: false, verify: false, reject: false, reverse: false, attachEvidence: false, earmark: false });
    }
  });

  it("takes proof only once the money is held for an event, and assigns an event only while it has none", () => {
    expect(receiptActions(receipt({ eventId: "evt_1" }))).toMatchObject({ attachEvidence: true, earmark: false });
    expect(receiptActions(receipt({ eventId: null }))).toMatchObject({ attachEvidence: false, earmark: true });
    for (const status of ["rejected", "reversed"] as const) {
      expect(receiptActions(receipt({ status, eventId: "evt_1", unapplied: 0 }))).toMatchObject({ attachEvidence: false, earmark: false });
    }
  });

  it("accepts only a PDF, JPG or PNG of up to 10 MB as proof, reading the type from the name when the browser gives none", () => {
    expect(evidenceProblem({ name: "slip.pdf", size: 48_000, type: "application/pdf" })).toBeNull();
    expect(evidenceProblem({ name: "wallet.PNG", size: 900_000, type: "" })).toBeNull();
    expect(evidenceProblem({ name: "slip.jpeg", size: 10 * 1024 * 1024, type: "image/jpeg" })).toBeNull();
    expect(evidenceProblem({ name: "sheet.xlsx", size: 1_000, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })).toMatch(/PDF, JPG or PNG/);
    expect(evidenceProblem({ name: "clip.mp4", size: 1_000, type: "video/mp4" })).toMatch(/PDF, JPG or PNG/);
    expect(evidenceProblem({ name: "slip", size: 1_000, type: "" })).toMatch(/PDF, JPG or PNG/);
    expect(evidenceProblem({ name: "slip.pdf", size: 0, type: "application/pdf" })).toMatch(/empty/);
    expect(evidenceProblem({ name: "slip.pdf", size: 10 * 1024 * 1024 + 1, type: "application/pdf" })).toMatch(/10 MB/);
    expect(fileSizeLabel(48_213)).toBe("47 KB");
    expect(fileSizeLabel(2_621_440)).toBe("2.5 MB");
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
