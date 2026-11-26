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
import { pmcmApi, storedEventAccessToken } from "@/lib/prism-api";

/** Receipts for one filter. Short freshness: a receipt changes whenever finance applies, reverses or refunds it. */
export const paymentReceipts = defineResource({
  name: "finance.payment-receipts",
  staleMs: 10_000,
  fetch: (query: ListPaymentReceiptsQuery, signal) => pmcmApi.paymentReceipts.list({ query }, { signal }),
});

/** The milestones of one event that are still owed, for choosing where to apply money. */
export const paymentAllocationTargets = defineResource({
  name: "finance.payment-allocation-targets",
  staleMs: 5_000,
  fetch: (eventId: string, signal) => pmcmApi.paymentReceipts.allocationTargets({ query: { eventId } }, { signal }),
});

export const receiptsRepository = {
  record: (input: RecordPaymentReceiptInput) => pmcmApi.paymentReceipts.record({ body: input }),
  allocate: (receiptId: string, input: AllocatePaymentReceiptInput) => pmcmApi.paymentReceipts.allocate({ params: { receiptId }, body: input }),
  reverseAllocation: (receiptId: string, recordId: string, input: ReversePaymentAllocationInput) =>
    pmcmApi.paymentReceipts.reverseAllocation({ params: { receiptId, recordId }, body: input }),
  /** The proof is stored with the receipt's event, as its own kind of file only PMCM can read. */
  uploadEvidence: (file: File, eventId: string, receiptId: string) =>
    uploadStorageObject(file, {
      eventId,
      ownerRecordType: "payment_receipt",
      ownerRecordId: receiptId,
      logicalTarget: paymentReceiptEvidenceTarget(receiptId, crypto.randomUUID()),
      usage: "payment_receipt_evidence",
    }, { authToken: storedEventAccessToken() }),
  attachEvidence: (receiptId: string, input: AttachPaymentReceiptEvidenceInput) => pmcmApi.paymentReceipts.attachEvidence({ params: { receiptId }, body: input }),
  downloadEvidence: (objectId: string) => getStorageObjectDownload(objectId, { authToken: storedEventAccessToken() }),
  earmark: (receiptId: string, input: EarmarkPaymentReceiptInput) => pmcmApi.paymentReceipts.earmark({ params: { receiptId }, body: input }),
  verify: (receiptId: string, input: VerifyPaymentReceiptInput) => pmcmApi.paymentReceipts.verify({ params: { receiptId }, body: input }),
  reject: (receiptId: string, input: RejectPaymentReceiptInput) => pmcmApi.paymentReceipts.reject({ params: { receiptId }, body: input }),
  reverse: (receiptId: string, input: ReversePaymentReceiptInput) => pmcmApi.paymentReceipts.reverse({ params: { receiptId }, body: input }),
  refund: (receiptId: string, input: RecordPaymentRefundInput) => pmcmApi.paymentReceipts.refund({ params: { receiptId }, body: input }),
};

export type ReceiptCommands = typeof receiptsRepository;
