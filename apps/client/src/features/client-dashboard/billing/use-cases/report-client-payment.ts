import { parseContract, paymentEvidenceProblem, submitClientPaymentSchema, type PrismPaymentSubmission } from "@prism/types";
import { clientPaymentRepository } from "../data/client-payment-repository";

export type ReportPaymentDraft = {
  amount: string;
  paidDate: string;
  method: string;
  referenceNumber: string;
  milestoneId: string;
  note: string;
  proof: File | null;
};

export type ReportPaymentResult = { submission: PrismPaymentSubmission; proofError: string | null };

type Writer = typeof clientPaymentRepository;

/** Upload the proof for a payment already reported, then bind it. Returns the payment as PMCM will see it. */
export async function addPaymentProof(writer: Pick<Writer, "uploadProof" | "attachProof">, eventId: string, receiptId: string, file: File): Promise<PrismPaymentSubmission> {
  const problem = paymentEvidenceProblem(file);
  if (problem) throw new Error(problem);
  const stored = await writer.uploadProof(file, eventId, receiptId);
  return writer.attachProof(eventId, receiptId, stored.id);
}

/**
 * Tell PMCM about a payment, with proof. The proof is checked before anything is sent. If the payment is recorded but
 * the proof then fails to upload, the payment stays reported and the client is told to add the proof again.
 */
export async function reportClientPayment(eventId: string, draft: ReportPaymentDraft, writer: Writer = clientPaymentRepository): Promise<ReportPaymentResult> {
  if (!draft.proof) throw new Error("Add a photo or PDF of your proof of payment.");
  const problem = paymentEvidenceProblem(draft.proof);
  if (problem) throw new Error(problem);
  const input = parseContract(submitClientPaymentSchema, {
    amount: Number(draft.amount.replace(/[^\d]/g, "")),
    paidDate: draft.paidDate,
    method: draft.method,
    referenceNumber: draft.referenceNumber,
    milestoneId: draft.milestoneId || undefined,
    note: draft.note.trim() || undefined,
    idempotencyKey: crypto.randomUUID(),
  }, "Payment");
  const submission = await writer.submit(eventId, input);
  try {
    return { submission: await addPaymentProof(writer, eventId, submission.id, draft.proof), proofError: null };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "The upload did not finish.";
    return { submission, proofError: `Your payment was sent, but the proof did not upload (${reason}). Add it again from "Payments you sent".` };
  }
}
