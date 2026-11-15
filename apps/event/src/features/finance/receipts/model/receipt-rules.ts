import {
  PAYMENT_RECEIPT_EVIDENCE_ACCEPT,
  PAYMENT_RECEIPT_EVIDENCE_HINT,
  paymentEvidenceProblem,
  type ListPaymentReceiptsQuery,
  type PrismPaymentReceipt,
  type PrismPaymentReceiptStatus,
} from "@prism/types";

export const RECEIPT_STATUS_LABELS: Record<PrismPaymentReceiptStatus, string> = {
  recorded: "Recorded",
  verified: "Verified",
  rejected: "Rejected",
  reversed: "Reversed",
};

export const RECEIPT_FILTERS = [
  { value: "unapplied", label: "Unapplied funds" },
  { value: "all", label: "All receipts" },
  { value: "recorded", label: "Not yet verified" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "reversed", label: "Reversed" },
] as const;
export type ReceiptFilter = (typeof RECEIPT_FILTERS)[number]["value"];

/** The server query for a filter: "unapplied" is its own flag, the rest are a status or nothing. */
export function filterToQuery(filter: ReceiptFilter): ListPaymentReceiptsQuery {
  if (filter === "all") return {};
  if (filter === "unapplied") return { unapplied: true };
  return { status: filter };
}

/** Whole pesos only, as the ledger holds them. "1,200" is 1200; a decimal, zero or text is not an amount. */
export function parsePesos(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export type ReceiptActions = {
  allocate: boolean;
  verify: boolean;
  reject: boolean;
  reverse: boolean;
  refund: boolean;
  /** Proof is filed under an event, so only a live receipt already held for one takes it. */
  attachEvidence: boolean;
  /** Money held with no event can be assigned one, once. */
  earmark: boolean;
};

/**
 * Which actions a receipt offers. The server enforces the same rules; this only hides what would be refused.
 * Rejecting says the money never arrived, so it needs nothing applied. Reversing undoes everything applied, but not
 * money already paid back.
 */
export function receiptActions(receipt: PrismPaymentReceipt): ReceiptActions {
  const live = receipt.status === "recorded" || receipt.status === "verified";
  const hasUnapplied = live && receipt.unapplied > 0;
  return {
    allocate: hasUnapplied,
    refund: hasUnapplied,
    verify: receipt.status === "recorded",
    reject: receipt.status === "recorded" && !receipt.allocations.some((slice) => !slice.reversed),
    reverse: live && receipt.refunded === 0,
    attachEvidence: live && receipt.eventId !== null,
    earmark: live && receipt.eventId === null,
  };
}

export function receiptTitle(receipt: PrismPaymentReceipt): string {
  return receipt.referenceNumber || `${receipt.method} receipt`;
}

/** What was said when a receipt was checked, rejected or reversed. Every one that applies shows, not just the first. */
export function receiptOutcomes(receipt: PrismPaymentReceipt): string[] {
  return [
    receipt.verificationNotes ? `Verified: ${receipt.verificationNotes}` : "",
    receipt.rejectionReason ? `Rejected: ${receipt.rejectionReason}` : "",
    receipt.reversalReason ? `Reversed: ${receipt.reversalReason}` : "",
  ].filter(Boolean);
}

/** What deserves a second look on a receipt, in plain words. */
export function receiptNotes(receipt: PrismPaymentReceipt): string[] {
  const notes: string[] = [];
  if (receipt.legacy) notes.push("Carried over from a payment recorded before receipts existed. No evidence is on file.");
  if (receipt.possibleDuplicateOfId) notes.push("Same amount, method, day and payer as another receipt. Check it is not a double entry.");
  if (receipt.source === "client") notes.push(`Reported by the client${receipt.intendedMilestoneLabel ? ` for ${receipt.intendedMilestoneLabel}` : ""}${receipt.evidence ? ", with proof" : ", no proof yet"}.`);
  if (receipt.status === "recorded" && !receipt.legacy) notes.push("Not yet checked against the bank or wallet statement.");
  return notes;
}

/** What a proof of payment may be. The shared contract holds the list the server enforces. */
export const EVIDENCE_ACCEPT = PAYMENT_RECEIPT_EVIDENCE_ACCEPT;
export const EVIDENCE_HINT = PAYMENT_RECEIPT_EVIDENCE_HINT;
export const evidenceProblem = paymentEvidenceProblem;

export function fileSizeLabel(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
