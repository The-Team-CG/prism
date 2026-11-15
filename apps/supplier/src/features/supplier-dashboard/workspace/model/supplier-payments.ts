import type { PrismSupplierPayableMilestone, PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard } from "@prism/types";
import { daysUntil, formatPortalDate } from "@prism/ui/format-date";
import { formatPeso, paymentStepState, type PaymentStep } from "@prism/ui/payment-track";

/** A supplier payout due within this many days is "due soon". */
export const PAYOUT_DUE_SOON_DAYS = 7;

const dayWord = (days: number) => (days === 1 ? "1 day" : `${days} days`);

function lastRelease(payable: PrismSupplierPayableMilestone): string | null {
  return payable.history.filter((record) => record.kind === "release").map((record) => record.paymentDate).sort().pop() ?? null;
}

function when(payable: PrismSupplierPayableMilestone, state: PaymentStep["state"], todayKey: string): string {
  if (state === "paid") {
    const last = lastRelease(payable);
    return last ? `Paid ${formatPortalDate(last)}` : "Paid in full";
  }
  if (!payable.dueDate) return "No due date yet";
  const due = `Due ${formatPortalDate(payable.dueDate)}`;
  const days = daysUntil(payable.dueDate.slice(0, 10), todayKey);
  if (days === null) return due;
  if (days < 0) return `${due} · ${dayWord(-days)} late`;
  return days <= PAYOUT_DUE_SOON_DAYS ? `${due} · ${days === 0 ? "today" : `in ${dayWord(days)}`}` : due;
}

/** One payout from PMCM as the supplier reads it: how much, how much has arrived, and when the rest is due. */
export function payoutStep(payable: PrismSupplierPayableMilestone, todayKey: string): PaymentStep {
  const days = payable.dueDate ? daysUntil(payable.dueDate.slice(0, 10), todayKey) : null;
  const state = paymentStepState({ paid: payable.amountReleased, remaining: payable.remainingBalance }, days, PAYOUT_DUE_SOON_DAYS);
  const notes = payable.amountReleased > 0 && payable.remainingBalance > 0 ? [`${formatPeso(payable.remainingBalance)} still to come`] : [];
  return { id: payable.id, label: payable.label, amount: payable.amount, paid: payable.amountReleased, state, when: when(payable, state, todayKey), notes };
}

export type SupplierBooking = {
  requestId: string;
  eventName: string;
  category: string | null;
  contract: number | null;
  terms: string;
  payables: PrismSupplierPayableMilestone[];
};

/**
 * Every won booking with what PMCM pays for it, named by its event. A booking whose payment schedule is not set yet
 * is listed with its agreed amount, so the supplier sees it is coming.
 */
export function supplierBookings(input: {
  payables: PrismSupplierPayableMilestone[];
  selectedQuotes: PrismSupplierQuote[];
  quoteRequests: PrismSupplierQuoteRequest[];
  readinessBoard: PrismSupplierReadinessBoard | null;
}): SupplierBooking[] {
  const requestIds = [...new Set([...input.selectedQuotes.flatMap((quote) => (quote.requestId ? [quote.requestId] : [])), ...input.payables.map((payable) => payable.requestId)])];
  return requestIds.map((requestId) => {
    const request = input.quoteRequests.find((item) => item.id === requestId);
    const quote = input.selectedQuotes.find((item) => item.requestId === requestId);
    return {
      requestId,
      eventName: input.readinessBoard?.items.find((item) => item.requestId === requestId)?.eventName ?? request?.category ?? "Booking",
      category: request?.category ?? null,
      contract: quote?.amount ?? null,
      terms: quote?.paymentTerms ?? "",
      payables: input.payables.filter((payable) => payable.requestId === requestId).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")),
    };
  });
}

/** Totals across every booking: paid so far, still to come, what is late, and the next payment due. */
export function supplierPaymentTotals(payables: PrismSupplierPayableMilestone[], todayKey: string) {
  const open = payables.filter((payable) => payable.remainingBalance > 0);
  const late = open.filter((payable) => payable.dueDate && (daysUntil(payable.dueDate.slice(0, 10), todayKey) ?? 0) < 0);
  const next = open.filter((payable) => !late.includes(payable) && payable.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0] ?? null;
  return {
    paid: payables.reduce((sum, payable) => sum + payable.amountReleased, 0),
    toCome: open.reduce((sum, payable) => sum + payable.remainingBalance, 0),
    late: late.reduce((sum, payable) => sum + payable.remainingBalance, 0),
    next,
  };
}
