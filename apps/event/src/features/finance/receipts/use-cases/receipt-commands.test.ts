import { describe, expect, it, vi } from "vitest";
import {
  submitAllocation,
  submitAllocationReversal,
  submitEarmark,
  submitEvidence,
  submitReceipt,
  submitReceiptReversal,
  submitRefund,
  submitRejection,
  submitVerification,
  type ReceiptDraft,
} from "./receipt-commands";

const receipt = { id: "prcp_1" } as never;

function createWriter() {
  return {
    record: vi.fn(async () => receipt),
    allocate: vi.fn(async () => receipt),
    reverseAllocation: vi.fn(async () => receipt),
    verify: vi.fn(async () => receipt),
    reject: vi.fn(async () => receipt),
    reverse: vi.fn(async () => receipt),
    refund: vi.fn(async () => receipt),
    uploadEvidence: vi.fn(async () => ({ id: "obj_9" }) as never),
    attachEvidence: vi.fn(async () => receipt),
    earmark: vi.fn(async () => receipt),
  };
}

const draft: ReceiptDraft = {
  amount: "1,200", receivedDate: "2026-11-10", method: "GCash", referenceNumber: " GC-9001 ", payerName: "  ", eventId: "evt_1", notes: "", milestoneId: "",
};

describe("receipt commands", () => {
  it("sends a receipt as whole pesos with blanks dropped and a fresh idempotency key per submission", async () => {
    const writer = createWriter();

    await submitReceipt(writer, draft);
    await submitReceipt(writer, { ...draft, milestoneId: "m1" });

    const [first, second] = writer.record.mock.calls.map((call) => (call as unknown as [Record<string, unknown>])[0]);
    expect(first).toMatchObject({ amount: 1200, receivedDate: "2026-11-10", method: "GCash", referenceNumber: "GC-9001", eventId: "evt_1" });
    // Blank fields are absent on the wire (undefined is dropped by JSON), not sent as empty strings.
    const wire = JSON.parse(JSON.stringify(first));
    expect(wire).not.toHaveProperty("payerName");
    expect(wire).not.toHaveProperty("notes");
    expect(wire).not.toHaveProperty("allocation");
    expect(second).toMatchObject({ allocation: { milestoneId: "m1" } });
    expect(first.idempotencyKey).toEqual(expect.any(String));
    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
  });

  it("refuses an unusable amount or a missing date before any request is sent", async () => {
    const writer = createWriter();

    for (const amount of ["", "0", "12.5", "abc", "-3"]) {
      await expect(submitReceipt(writer, { ...draft, amount })).rejects.toThrow("Amount received must be a whole number of pesos above zero.");
    }
    await expect(submitReceipt(writer, { ...draft, receivedDate: " " })).rejects.toThrow("Choose the date the money arrived.");
    expect(writer.record).not.toHaveBeenCalled();
  });

  it("needs a milestone and a real amount to apply money, and a reason or note for every other action", async () => {
    const writer = createWriter();

    await expect(submitAllocation(writer, "prcp_1", { milestoneId: "", amount: "100" })).rejects.toThrow("Choose the milestone");
    await expect(submitAllocation(writer, "prcp_1", { milestoneId: "m1", amount: "0" })).rejects.toThrow("Amount to apply");
    await expect(submitAllocationReversal(writer, "prcp_1", "payrec_1", "  ")).rejects.toThrow("Say why this payment is being undone");
    await expect(submitVerification(writer, "prcp_1", "")).rejects.toThrow("Say what you checked");
    await expect(submitRejection(writer, "prcp_1", " ")).rejects.toThrow("Say why the money never arrived");
    await expect(submitReceiptReversal(writer, "prcp_1", "")).rejects.toThrow("Say why this receipt is being reversed");
    await expect(submitRefund(writer, "prcp_1", { amount: "500", refundedDate: "2026-11-11", method: "Bank Transfer", referenceNumber: "", reason: "" })).rejects.toThrow("Say why the money is being paid back");
    for (const call of Object.values(writer)) expect(call).not.toHaveBeenCalled();
  });

  it("uploads proof under the receipt's own event, then binds the stored file to that receipt", async () => {
    const writer = createWriter();
    const file = new File(["%PDF-1.7"], "slip.pdf", { type: "application/pdf" });

    await submitEvidence(writer, { id: "prcp_1", eventId: "evt_1" }, file);

    expect(writer.uploadEvidence).toHaveBeenCalledWith(file, "evt_1", "prcp_1");
    expect(writer.attachEvidence).toHaveBeenCalledWith("prcp_1", { objectId: "obj_9" });
  });

  it("sends nothing when the proof is missing, the wrong kind, or the money has no event yet", async () => {
    const writer = createWriter();
    const held = { id: "prcp_1", eventId: "evt_1" };

    await expect(submitEvidence(writer, held, null)).rejects.toThrow("Choose the file");
    await expect(submitEvidence(writer, held, new File(["x"], "sheet.xlsx", { type: "application/vnd.ms-excel" }))).rejects.toThrow("PDF, JPG or PNG");
    await expect(submitEvidence(writer, { id: "prcp_1", eventId: null }, new File(["x"], "slip.pdf", { type: "application/pdf" }))).rejects.toThrow("which event");
    expect(writer.uploadEvidence).not.toHaveBeenCalled();
    expect(writer.attachEvidence).not.toHaveBeenCalled();
  });

  it("does not bind anything when the upload fails, and assigns an event only when one is chosen", async () => {
    const writer = createWriter();
    writer.uploadEvidence.mockRejectedValueOnce(new Error("Storage provider is not configured"));

    await expect(submitEvidence(writer, { id: "prcp_1", eventId: "evt_1" }, new File(["x"], "slip.png", { type: "image/png" }))).rejects.toThrow("Storage provider is not configured");
    expect(writer.attachEvidence).not.toHaveBeenCalled();

    await expect(submitEarmark(writer, "prcp_1", " ")).rejects.toThrow("Choose the event");
    expect(writer.earmark).not.toHaveBeenCalled();
    await submitEarmark(writer, "prcp_1", " evt_2 ");
    expect(writer.earmark).toHaveBeenCalledWith("prcp_1", { eventId: "evt_2" });
  });

  it("routes each valid command to its own receipt with the trimmed text", async () => {
    const writer = createWriter();

    await submitAllocation(writer, "prcp_1", { milestoneId: "m1", amount: "40,000" });
    await submitAllocationReversal(writer, "prcp_1", "payrec_9", " Wrong milestone ");
    await submitVerification(writer, "prcp_1", " Matches the BDO line of 10 Nov ");
    await submitRejection(writer, "prcp_2", "No such transfer");
    await submitReceiptReversal(writer, "prcp_3", "Cheque bounced");
    await submitRefund(writer, "prcp_4", { amount: "500", refundedDate: "2026-11-11", method: "Bank Transfer", referenceNumber: " RF-1 ", reason: "Overpaid" });

    expect(writer.allocate).toHaveBeenCalledWith("prcp_1", expect.objectContaining({ milestoneId: "m1", amount: 40000 }));
    expect(writer.reverseAllocation).toHaveBeenCalledWith("prcp_1", "payrec_9", { reason: "Wrong milestone" });
    expect(writer.verify).toHaveBeenCalledWith("prcp_1", { notes: "Matches the BDO line of 10 Nov" });
    expect(writer.reject).toHaveBeenCalledWith("prcp_2", { reason: "No such transfer" });
    expect(writer.reverse).toHaveBeenCalledWith("prcp_3", { reason: "Cheque bounced" });
    expect(writer.refund).toHaveBeenCalledWith("prcp_4", expect.objectContaining({ amount: 500, referenceNumber: "RF-1", reason: "Overpaid" }));
  });
});
