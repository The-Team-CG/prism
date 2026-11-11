import { z } from "zod";

/** Payment methods P.R.I.S.M records. Money moves outside the app; these name how it arrived or was returned. */
export const PAYMENT_RECEIPT_METHODS = ["Bank Transfer", "GCash", "Cheque"] as const;
export const paymentReceiptMethodSchema = z.enum(PAYMENT_RECEIPT_METHODS);

export const PAYMENT_RECEIPT_STATUSES = ["recorded", "verified", "rejected", "reversed"] as const;
export const paymentReceiptStatusSchema = z.enum(PAYMENT_RECEIPT_STATUSES);
export type PaymentReceiptStatus = z.infer<typeof paymentReceiptStatusSchema>;

const dateSchema = z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "Must be a valid date");
const idSchema = z.string().trim().min(1).max(200);
const keySchema = z.string().trim().min(1).max(200).optional();
const reasonSchema = z.string().trim().min(1, "A reason is required").max(500);
const wholePesosSchema = z.number().int().min(1);

/**
 * Record money that arrived. Name the milestone to apply it straight away (the whole receipt unless an amount is
 * given); leave it out to hold the money as unapplied until it is allocated.
 */
export const recordPaymentReceiptSchema = z.object({
  amount: wholePesosSchema,
  receivedDate: dateSchema,
  method: paymentReceiptMethodSchema,
  referenceNumber: z.string().trim().max(120).optional(),
  payerName: z.string().trim().max(200).optional(),
  /** The event the payer meant to pay for, when known. Allocation decides where the money goes. */
  eventId: idSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
  allocation: z.object({ milestoneId: idSchema, amount: wholePesosSchema.optional() }).strict().optional(),
  idempotencyKey: keySchema,
}).strict();
export type RecordPaymentReceiptInput = z.infer<typeof recordPaymentReceiptSchema>;

export const allocatePaymentReceiptSchema = z.object({ milestoneId: idSchema, amount: wholePesosSchema, idempotencyKey: keySchema }).strict();
export type AllocatePaymentReceiptInput = z.infer<typeof allocatePaymentReceiptSchema>;

/** Say what was checked, for example the bank statement line the receipt matches. */
export const verifyPaymentReceiptSchema = z.object({ notes: z.string().trim().min(1, "Say what was checked").max(1000) }).strict();
export type VerifyPaymentReceiptInput = z.infer<typeof verifyPaymentReceiptSchema>;

export const rejectPaymentReceiptSchema = z.object({ reason: reasonSchema }).strict();
export type RejectPaymentReceiptInput = z.infer<typeof rejectPaymentReceiptSchema>;

export const reversePaymentAllocationSchema = z.object({ reason: reasonSchema }).strict();
export type ReversePaymentAllocationInput = z.infer<typeof reversePaymentAllocationSchema>;

export const reversePaymentReceiptSchema = z.object({ reason: reasonSchema }).strict();
export type ReversePaymentReceiptInput = z.infer<typeof reversePaymentReceiptSchema>;

/** A refund of unapplied money that was already paid back outside P.R.I.S.M. */
export const recordPaymentRefundSchema = z.object({
  amount: wholePesosSchema,
  refundedDate: dateSchema,
  method: paymentReceiptMethodSchema,
  referenceNumber: z.string().trim().max(120).optional(),
  reason: reasonSchema,
  idempotencyKey: keySchema,
}).strict();
export type RecordPaymentRefundInput = z.infer<typeof recordPaymentRefundSchema>;

export const listPaymentReceiptsQuerySchema = z.object({
  status: paymentReceiptStatusSchema.optional(),
  /** Only receipts with money still unapplied. */
  unapplied: z.preprocess((value) => value === true || value === "true" || value === "1", z.boolean()).optional(),
  /** Receipts meant for, or applied to, this event. */
  eventId: idSchema.optional(),
  limit: z.preprocess((value) => (value === undefined || value === "" ? undefined : Number(value)), z.number().int().min(1).max(100)).optional(),
}).strict();
export type ListPaymentReceiptsQuery = z.infer<typeof listPaymentReceiptsQuerySchema>;
