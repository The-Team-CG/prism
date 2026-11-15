import { describe, expect, it, vi } from "vitest";
import type { PrismPaymentSubmission } from "@prism/types";
import { reportClientPayment, type ReportPaymentDraft } from "./report-client-payment";

vi.mock("@/lib/prism-api", () => ({ clientApi: {}, storedClientAccessToken: () => null }));

const sent: PrismPaymentSubmission = { id: "prcp_1", amount: 60000, paidDate: "2026-11-10", method: "GCash", reference: "GC-1", state: "checking", reason: null, forPayment: "Second payment", unapplied: 60000, fromClient: true, hasProof: false };

function draft(overrides: Partial<ReportPaymentDraft> = {}): ReportPaymentDraft {
  return { amount: "60,000", paidDate: "2026-11-10", method: "GCash", referenceNumber: "GC-1", milestoneId: "m2", note: "", proof: new File(["x"], "transfer.png", { type: "image/png" }), ...overrides };
}

function writer() {
  return {
    submit: vi.fn(async () => sent),
    uploadProof: vi.fn(async () => ({ id: "obj_1" })),
    attachProof: vi.fn(async () => ({ ...sent, hasProof: true })),
  };
}

describe("reporting a payment", () => {
  it("sends the payment, then uploads and binds the proof to it", async () => {
    const fake = writer();
    const result = await reportClientPayment("evt_1", draft(), fake as never);

    expect(fake.submit).toHaveBeenCalledWith("evt_1", expect.objectContaining({ amount: 60000, method: "GCash", referenceNumber: "GC-1", milestoneId: "m2" }));
    expect(fake.attachProof).toHaveBeenCalledWith("evt_1", "prcp_1", "obj_1");
    expect(result).toEqual({ submission: { ...sent, hasProof: true }, proofError: null });
  });

  it("refuses before sending anything when the proof is missing or is not a PDF or image", async () => {
    for (const proof of [null, new File(["x"], "notes.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })]) {
      const fake = writer();
      await expect(reportClientPayment("evt_1", draft({ proof }), fake as never)).rejects.toThrow(/proof|PDF/i);
      expect(fake.submit).not.toHaveBeenCalled();
    }
  });

  it("keeps the payment sent when only the proof upload fails, and tells the client to add it again", async () => {
    const fake = { ...writer(), uploadProof: vi.fn(async () => { throw new Error("network down"); }) };
    const result = await reportClientPayment("evt_1", draft(), fake as never);

    expect(result.submission).toEqual(sent);
    expect(result.proofError).toMatch(/payment was sent.*network down.*Add it again/);
  });
});
