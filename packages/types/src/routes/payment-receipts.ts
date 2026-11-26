import { z } from "zod";
import {
  allocatePaymentReceiptSchema,
  attachPaymentReceiptEvidenceSchema,
  earmarkPaymentReceiptSchema,
  listPaymentAllocationTargetsQuerySchema,
  listPaymentReceiptsQuerySchema,
  recordPaymentReceiptSchema,
  recordPaymentRefundSchema,
  rejectPaymentReceiptSchema,
  reversePaymentAllocationSchema,
  reversePaymentReceiptSchema,
  verifyPaymentReceiptSchema,
} from "../schemas/payment-receipt-inputs.js";
import { paymentAllocationTargetSchema, paymentReceiptSchema } from "../schemas/payment-receipt-reads.js";
import { defineRoute } from "./define-route.js";

/**
 * Money that arrived outside P.R.I.S.M. A receipt is not tied to one event: it is recorded first and applied to
 * milestones afterwards. Every route is PMCM finance only.
 */
export const paymentReceiptRoutes = {
  list: defineRoute({
    method: "GET", path: "payment-receipts", roles: ["pmcm"],
    query: listPaymentReceiptsQuerySchema, response: z.array(paymentReceiptSchema),
  }),
  /** The milestones of one event that are still owed, for choosing where to apply money. */
  allocationTargets: defineRoute({
    method: "GET", path: "payment-receipts/allocation-targets", roles: ["pmcm"],
    query: listPaymentAllocationTargetsQuerySchema, response: z.array(paymentAllocationTargetSchema),
  }),
  record: defineRoute({
    method: "POST", path: "payment-receipts", roles: ["pmcm"], status: 201,
    body: recordPaymentReceiptSchema, response: paymentReceiptSchema,
  }),
  allocate: defineRoute({
    method: "POST", path: "payment-receipts/:receiptId/allocations", roles: ["pmcm"], status: 201,
    body: allocatePaymentReceiptSchema, response: paymentReceiptSchema,
  }),
  reverseAllocation: defineRoute({
    method: "POST", path: "payment-receipts/:receiptId/allocations/:recordId/reverse", roles: ["pmcm"],
    body: reversePaymentAllocationSchema, response: paymentReceiptSchema,
  }),
  attachEvidence: defineRoute({
    method: "POST", path: "payment-receipts/:receiptId/evidence", roles: ["pmcm"],
    body: attachPaymentReceiptEvidenceSchema, response: paymentReceiptSchema,
  }),
  /** Says which event money held with no event was meant for. */
  earmark: defineRoute({
    method: "POST", path: "payment-receipts/:receiptId/event", roles: ["pmcm"],
    body: earmarkPaymentReceiptSchema, response: paymentReceiptSchema,
  }),
  verify: defineRoute({
    method: "POST", path: "payment-receipts/:receiptId/verify", roles: ["pmcm"],
    body: verifyPaymentReceiptSchema, response: paymentReceiptSchema,
  }),
  reject: defineRoute({
    method: "POST", path: "payment-receipts/:receiptId/reject", roles: ["pmcm"],
    body: rejectPaymentReceiptSchema, response: paymentReceiptSchema,
  }),
  reverse: defineRoute({
    method: "POST", path: "payment-receipts/:receiptId/reverse", roles: ["pmcm"],
    body: reversePaymentReceiptSchema, response: paymentReceiptSchema,
  }),
  refund: defineRoute({
    method: "POST", path: "payment-receipts/:receiptId/refunds", roles: ["pmcm"], status: 201,
    body: recordPaymentRefundSchema, response: paymentReceiptSchema,
  }),
};
