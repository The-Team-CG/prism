import { defineResource } from "@prism/portal-query";
import type {
  AllocatePaymentReceiptInput,
  ListPaymentReceiptsQuery,
  RecordPaymentReceiptInput,
  RecordPaymentRefundInput,
  RejectPaymentReceiptInput,
  ReversePaymentAllocationInput,
  ReversePaymentReceiptInput,
  VerifyPaymentReceiptInput,
} from "@prism/types";
import { eventApi } from "@/lib/prism-api";

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
  verify: (receiptId: string, input: VerifyPaymentReceiptInput) => eventApi.commercial.verifyPaymentReceipt(receiptId, input),
  reject: (receiptId: string, input: RejectPaymentReceiptInput) => eventApi.commercial.rejectPaymentReceipt(receiptId, input),
  reverse: (receiptId: string, input: ReversePaymentReceiptInput) => eventApi.commercial.reversePaymentReceipt(receiptId, input),
  refund: (receiptId: string, input: RecordPaymentRefundInput) => eventApi.commercial.recordPaymentRefund(receiptId, input),
};

export type ReceiptCommands = typeof receiptsRepository;
