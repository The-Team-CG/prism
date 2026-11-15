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

/** The open milestones of one event that a receipt can be applied to. */
export const listPaymentAllocationTargetsQuerySchema = z.object({ eventId: idSchema }).strict();
export type ListPaymentAllocationTargetsQuery = z.infer<typeof listPaymentAllocationTargetsQuerySchema>;

/** Bind an uploaded, confirmed file as the proof for a receipt. The file must have been uploaded as that receipt's evidence. */
export const attachPaymentReceiptEvidenceSchema = z.object({ objectId: idSchema }).strict();
export type AttachPaymentReceiptEvidenceInput = z.infer<typeof attachPaymentReceiptEvidenceSchema>;

/** Say which event money held with no event was meant for, so it can carry evidence and show on that client's statement. */
export const earmarkPaymentReceiptSchema = z.object({ eventId: idSchema }).strict();
export type EarmarkPaymentReceiptInput = z.infer<typeof earmarkPaymentReceiptSchema>;

/**
 * A client telling PMCM they paid. It is held as money to check, never applied straight away: PMCM verifies it against
 * the bank or wallet statement and then applies it, ideally to the payment the client named.
 */
export const submitClientPaymentSchema = z.object({
  amount: wholePesosSchema,
  paidDate: dateSchema,
  method: paymentReceiptMethodSchema,
  referenceNumber: z.string().trim().min(1, "Add the reference from your bank or wallet").max(120),
  milestoneId: idSchema.optional(),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: keySchema,
}).strict();
export type SubmitClientPaymentInput = z.infer<typeof submitClientPaymentSchema>;

/** Proof of payment is a statement PDF or a screenshot: small, and never a document or a video. One list for the form and the API. */
export const PAYMENT_RECEIPT_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const PAYMENT_RECEIPT_EVIDENCE_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

/** Storage target for one proof of payment uploaded for a receipt; the attempt id keeps a re-upload from colliding with the first. */
export function paymentReceiptEvidenceTarget(receiptId: string, attemptId: string): string {
  return `payment-receipt-evidence:${receiptId}:${attemptId}`;
}

const EVIDENCE_TYPE_BY_EXTENSION: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

/** What a proof of payment may be, in words, and as an input `accept` list. The server enforces the same list. */
export const PAYMENT_RECEIPT_EVIDENCE_ACCEPT = PAYMENT_RECEIPT_EVIDENCE_CONTENT_TYPES.join(",");
export const PAYMENT_RECEIPT_EVIDENCE_HINT = "A PDF, JPG or PNG up to 10 MB, such as a bank statement line or a wallet screenshot.";

/** Why a file cannot be proof of payment, checked before it leaves the browser; null when it can. */
export function paymentEvidenceProblem(file: { name: string; size: number; type: string }): string | null {
  const type = file.type.toLowerCase() || EVIDENCE_TYPE_BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] || "";
  if (!(PAYMENT_RECEIPT_EVIDENCE_CONTENT_TYPES as readonly string[]).includes(type)) return "Proof must be a PDF, JPG or PNG.";
  if (file.size === 0) return "That file is empty.";
  return file.size > PAYMENT_RECEIPT_EVIDENCE_MAX_BYTES ? "Proof must be 10 MB or smaller." : null;
}
