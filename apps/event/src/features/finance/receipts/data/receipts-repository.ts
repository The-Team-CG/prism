import { defineResource } from "@prism/portal-query";
import { getStorageObjectDownload, uploadStorageObject } from "@prism/api-client";
import { paymentReceiptEvidenceTarget } from "@prism/types";
import type {
  AllocatePaymentReceiptInput,
  AttachPaymentReceiptEvidenceInput,
  EarmarkPaymentReceiptInput,
  ListPaymentReceiptsQuery,
  RecordPaymentReceiptInput,
  RecordPaymentRefundInput,
  RejectPaymentReceiptInput,
  ReversePaymentAllocationInput,
  ReversePaymentReceiptInput,
  VerifyPaymentReceiptInput,
} from "@prism/types";
import { eventApi, storedEventAccessToken } from "@/lib/prism-api";

/** Receipts for one filter. Short freshness: a receipt changes whenever finance applies, reverses or refunds it. */
export const paymentReceipts = defineResource({
  name: "finance.payment-receipts",
  staleMs: 10_000,
  fetch: (query: ListPaymentReceiptsQuery, signal) => eventApi.commercial.listPaymentReceipts(query, { signal }),
});

/** The milestones of one event that are still owed, for choosing where to apply money. */
export const paymentAllocationTargets = defineResource({
  name: "finance.payment-allocation-targets",
  staleMs: 5_000,
  fetch: (eventId: string, signal) => eventApi.commercial.paymentAllocationTargets({ eventId }, { signal }),
});

export const receiptsRepository = {
  record: (input: RecordPaymentReceiptInput) => eventApi.commercial.recordPaymentReceipt(input),
  allocate: (receiptId: string, input: AllocatePaymentReceiptInput) => eventApi.commercial.allocatePaymentReceipt(receiptId, input),
  reverseAllocation: (receiptId: string, recordId: string, input: ReversePaymentAllocationInput) =>
    eventApi.commercial.reversePaymentAllocation(receiptId, recordId, input),
  /** The proof is stored with the receipt's event, as its own kind of file only PMCM can read. */
  uploadEvidence: (file: File, eventId: string, receiptId: string) =>
    uploadStorageObject(file, {
      eventId,
      ownerRecordType: "payment_receipt",
      ownerRecordId: receiptId,
      logicalTarget: paymentReceiptEvidenceTarget(receiptId, crypto.randomUUID()),
      usage: "payment_receipt_evidence",
    }, { authToken: storedEventAccessToken() }),
  attachEvidence: (receiptId: string, input: AttachPaymentReceiptEvidenceInput) => eventApi.commercial.attachPaymentReceiptEvidence(receiptId, input),
  downloadEvidence: (objectId: string) => getStorageObjectDownload(objectId, { authToken: storedEventAccessToken() }),
  earmark: (receiptId: string, input: EarmarkPaymentReceiptInput) => eventApi.commercial.earmarkPaymentReceipt(receiptId, input),
  verify: (receiptId: string, input: VerifyPaymentReceiptInput) => eventApi.commercial.verifyPaymentReceipt(receiptId, input),
  reject: (receiptId: string, input: RejectPaymentReceiptInput) => eventApi.commercial.rejectPaymentReceipt(receiptId, input),
  reverse: (receiptId: string, input: ReversePaymentReceiptInput) => eventApi.commercial.reversePaymentReceipt(receiptId, input),
  refund: (receiptId: string, input: RecordPaymentRefundInput) => eventApi.commercial.recordPaymentRefund(receiptId, input),
};

export type ReceiptCommands = typeof receiptsRepository;
