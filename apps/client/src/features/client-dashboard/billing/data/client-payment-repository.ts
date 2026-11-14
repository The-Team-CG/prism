import { uploadStorageObject } from "@prism/api-client";
import { paymentReceiptEvidenceTarget, type SubmitClientPaymentInput } from "@prism/types";
import { clientApi, storedClientAccessToken } from "@/lib/prism-api";

/** A client reporting a payment they made, and the proof for it. PMCM checks both before the money counts. */
export const clientPaymentRepository = {
  submit(eventId: string, input: SubmitClientPaymentInput) {
    return clientApi.commercial.submitClientPayment(eventId, input);
  },
  /** The proof is stored with the event as the payment's evidence, which only PMCM can open. */
  uploadProof(file: File, eventId: string, receiptId: string) {
    return uploadStorageObject(file, {
      eventId,
      ownerRecordType: "payment_receipt",
      ownerRecordId: receiptId,
      logicalTarget: paymentReceiptEvidenceTarget(receiptId, crypto.randomUUID()),
      usage: "payment_receipt_evidence",
    }, { authToken: storedClientAccessToken() });
  },
  attachProof(eventId: string, receiptId: string, objectId: string) {
    return clientApi.commercial.attachClientPaymentProof(eventId, receiptId, { objectId });
  },
};
