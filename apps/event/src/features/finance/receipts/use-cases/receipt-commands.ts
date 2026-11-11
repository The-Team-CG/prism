import {
  allocatePaymentReceiptSchema,
  attachPaymentReceiptEvidenceSchema,
  earmarkPaymentReceiptSchema,
  parseContract,
  recordPaymentReceiptSchema,
  recordPaymentRefundSchema,
  rejectPaymentReceiptSchema,
  reversePaymentAllocationSchema,
  reversePaymentReceiptSchema,
  verifyPaymentReceiptSchema,
  PAYMENT_RECEIPT_METHODS,
  type PrismPaymentReceipt,
} from "@prism/types";
import { evidenceProblem, parsePesos } from "../model/receipt-rules";
import type { ReceiptCommands } from "../data/receipts-repository";

export type ReceiptMethod = (typeof PAYMENT_RECEIPT_METHODS)[number];

export type ReceiptDraft = {
  amount: string;
  receivedDate: string;
  method: ReceiptMethod;
  referenceNumber: string;
  payerName: string;
  eventId: string;
  notes: string;
  /** Apply the whole receipt to this milestone straight away; empty keeps the money unapplied. */
  milestoneId: string;
};

export type RefundDraft = { amount: string; refundedDate: string; method: ReceiptMethod; referenceNumber: string; reason: string };

const blankToUndefined = (value: string) => (value.trim() === "" ? undefined : value.trim());

function requireAmount(text: string, label: string): number {
  const amount = parsePesos(text);
  if (amount === null) throw new Error(`${label} must be a whole number of pesos above zero.`);
  return amount;
}

function requireText(text: string, message: string): string {
  if (text.trim() === "") throw new Error(message);
  return text.trim();
}

/**
 * Each command refuses blocked input before any request is sent, then lets the shared schema produce the wire body.
 * A fresh idempotency key per submission means a double click or a retry after a dropped response cannot record twice.
 */
export async function submitReceipt(writer: Pick<ReceiptCommands, "record">, draft: ReceiptDraft): Promise<PrismPaymentReceipt> {
  const amount = requireAmount(draft.amount, "Amount received");
  requireText(draft.receivedDate, "Choose the date the money arrived.");
  const input = parseContract(recordPaymentReceiptSchema, {
    amount,
    receivedDate: draft.receivedDate,
    method: draft.method,
    referenceNumber: blankToUndefined(draft.referenceNumber),
    payerName: blankToUndefined(draft.payerName),
    eventId: blankToUndefined(draft.eventId),
    notes: blankToUndefined(draft.notes),
    allocation: draft.milestoneId ? { milestoneId: draft.milestoneId } : undefined,
    idempotencyKey: crypto.randomUUID(),
  }, "Payment receipt");
  return writer.record(input);
}

export async function submitAllocation(
  writer: Pick<ReceiptCommands, "allocate">,
  receiptId: string,
  draft: { milestoneId: string; amount: string },
): Promise<PrismPaymentReceipt> {
  requireText(draft.milestoneId, "Choose the milestone to apply the money to.");
  const input = parseContract(allocatePaymentReceiptSchema, {
    milestoneId: draft.milestoneId,
    amount: requireAmount(draft.amount, "Amount to apply"),
    idempotencyKey: crypto.randomUUID(),
  }, "Allocation");
  return writer.allocate(receiptId, input);
}

export async function submitAllocationReversal(
  writer: Pick<ReceiptCommands, "reverseAllocation">,
  receiptId: string,
  recordId: string,
  reason: string,
): Promise<PrismPaymentReceipt> {
  const input = parseContract(reversePaymentAllocationSchema, { reason: requireText(reason, "Say why this payment is being undone.") }, "Reversal");
  return writer.reverseAllocation(receiptId, recordId, input);
}

/**
 * Proof of payment is uploaded as a file of the receipt's event, then bound to the receipt. The file is checked here first
 * so a wrong file never leaves the browser; the server checks it again, and refuses a file that was not uploaded for this receipt.
 */
export async function submitEvidence(
  writer: Pick<ReceiptCommands, "uploadEvidence" | "attachEvidence">,
  receipt: Pick<PrismPaymentReceipt, "id" | "eventId">,
  file: File | null,
): Promise<PrismPaymentReceipt> {
  if (!file) throw new Error("Choose the file that proves the money arrived.");
  const problem = evidenceProblem(file);
  if (problem) throw new Error(problem);
  if (!receipt.eventId) throw new Error("Say which event this money was meant for before attaching proof.");
  const stored = await writer.uploadEvidence(file, receipt.eventId, receipt.id);
  const input = parseContract(attachPaymentReceiptEvidenceSchema, { objectId: stored.id }, "Evidence");
  return writer.attachEvidence(receipt.id, input);
}

export async function submitEarmark(writer: Pick<ReceiptCommands, "earmark">, receiptId: string, eventId: string): Promise<PrismPaymentReceipt> {
  const input = parseContract(earmarkPaymentReceiptSchema, { eventId: requireText(eventId, "Choose the event this money was meant for.") }, "Event assignment");
  return writer.earmark(receiptId, input);
}

export async function submitVerification(writer: Pick<ReceiptCommands, "verify">, receiptId: string, notes: string): Promise<PrismPaymentReceipt> {
  const input = parseContract(verifyPaymentReceiptSchema, { notes: requireText(notes, "Say what you checked, for example the statement line it matches.") }, "Verification");
  return writer.verify(receiptId, input);
}

export async function submitRejection(writer: Pick<ReceiptCommands, "reject">, receiptId: string, reason: string): Promise<PrismPaymentReceipt> {
  const input = parseContract(rejectPaymentReceiptSchema, { reason: requireText(reason, "Say why the money never arrived.") }, "Rejection");
  return writer.reject(receiptId, input);
}

export async function submitReceiptReversal(writer: Pick<ReceiptCommands, "reverse">, receiptId: string, reason: string): Promise<PrismPaymentReceipt> {
  const input = parseContract(reversePaymentReceiptSchema, { reason: requireText(reason, "Say why this receipt is being reversed, for example a bounced cheque.") }, "Receipt reversal");
  return writer.reverse(receiptId, input);
}

export async function submitRefund(writer: Pick<ReceiptCommands, "refund">, receiptId: string, draft: RefundDraft): Promise<PrismPaymentReceipt> {
  requireText(draft.refundedDate, "Choose the date the money was paid back.");
  const input = parseContract(recordPaymentRefundSchema, {
    amount: requireAmount(draft.amount, "Refund amount"),
    refundedDate: draft.refundedDate,
    method: draft.method,
    referenceNumber: blankToUndefined(draft.referenceNumber),
    reason: requireText(draft.reason, "Say why the money is being paid back."),
    idempotencyKey: crypto.randomUUID(),
  }, "Refund");
  return writer.refund(receiptId, input);
}
