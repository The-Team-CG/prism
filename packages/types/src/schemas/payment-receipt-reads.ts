import { z } from "zod";
import { paymentReceiptStatusSchema } from "./payment-receipt-inputs.js";

/**
 * What the payment receipt routes return. The API client parses every response with these, so a field the API stops
 * sending, or sends in another shape, fails loudly at the boundary instead of rendering as blank.
 */

/** One slice of a receipt applied to a milestone. A reversed slice stays listed, with the reversal that undid it. */
export const paymentReceiptAllocationSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  milestoneId: z.string(),
  milestoneLabel: z.string().nullable(),
  amount: z.number(),
  reversed: z.boolean(),
  reversalId: z.string().nullable(),
  reversalReason: z.string().nullable(),
  recordedAt: z.string(),
});
export type PrismPaymentReceiptAllocation = z.infer<typeof paymentReceiptAllocationSchema>;

export const paymentRefundSchema = z.object({
  id: z.string(),
  amount: z.number(),
  refundedDate: z.string(),
  method: z.string(),
  referenceNumber: z.string(),
  reason: z.string(),
  recordedBy: z.string(),
  recordedAt: z.string(),
});
export type PrismPaymentRefund = z.infer<typeof paymentRefundSchema>;

export const paymentReceiptEvidenceSchema = z.object({
  objectId: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  byteSize: z.number(),
});
export type PrismPaymentReceiptEvidence = z.infer<typeof paymentReceiptEvidenceSchema>;

/** Money that arrived outside P.R.I.S.M. `unapplied` is what is left after allocations and refunds. */
export const paymentReceiptSchema = z.object({
  id: z.string(),
  amount: z.number(),
  receivedDate: z.string(),
  method: z.string(),
  referenceNumber: z.string(),
  payerName: z.string(),
  eventId: z.string().nullable(),
  notes: z.string(),
  status: paymentReceiptStatusSchema,
  /** Who recorded it: PMCM finance, or the client telling PMCM they paid. */
  source: z.enum(["pmcm", "client"]),
  /** The payment the client said this money was for. PMCM still decides where it goes. */
  intendedMilestoneId: z.string().nullable(),
  intendedMilestoneLabel: z.string().nullable(),
  /** A receipt carried over from a payment recorded before receipts existed: no evidence, never checked. */
  legacy: z.boolean(),
  evidenceObjectId: z.string().nullable(),
  /** The stored proof of payment (a bank statement line, a screenshot), when one was attached and is still held. */
  evidence: paymentReceiptEvidenceSchema.nullable(),
  verifiedAt: z.string().nullable(),
  verifiedBy: z.string().nullable(),
  verificationNotes: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  reversalReason: z.string().nullable(),
  /** Another live receipt with the same amount, method, date and payer: worth a look, not a block. */
  possibleDuplicateOfId: z.string().nullable(),
  applied: z.number(),
  refunded: z.number(),
  unapplied: z.number(),
  allocations: z.array(paymentReceiptAllocationSchema),
  refunds: z.array(paymentRefundSchema),
  recordedBy: z.string(),
  recordedAt: z.string(),
});
export type PrismPaymentReceipt = z.infer<typeof paymentReceiptSchema>;

/** A milestone a receipt can be applied to: still owed, not superseded. */
export const paymentAllocationTargetSchema = z.object({
  milestoneId: z.string(),
  eventId: z.string(),
  eventName: z.string(),
  label: z.string(),
  amount: z.number(),
  remainingBalance: z.number(),
  dueDate: z.string(),
  status: z.string(),
});
export type PrismPaymentAllocationTarget = z.infer<typeof paymentAllocationTargetSchema>;
