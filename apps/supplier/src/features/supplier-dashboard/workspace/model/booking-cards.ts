import type { PrismSupplierPayableMilestone, PrismSupplierReadinessItem } from "@prism/types";
import { daysUntil, manilaCalendarKey, manilaDateKey } from "@prism/ui/format-date";
import { supplierNextStep } from "./supplier-next-step";
import { buildBookingSteps } from "./supplier-workspace-rules";
import type { PrismSupplierQuoteRequest } from "./supplier-workspace-types";

const YOUR_TURN = "Your next step";
/** A booking is urgent when it is the supplier's turn and the event is this close, or arrival is already late. */
const URGENT_WITHIN_DAYS = 7;

export type BookingCardFacts = {
  request: PrismSupplierQuoteRequest;
  eventName: string;
  eventDate: string | null;
  next: { title: string; owner: string };
  yourTurn: boolean;
  urgent: boolean;
  steps: { done: number; total: number };
  /** What PMCM agreed to pay on this booking and has released so far; null before a payment schedule exists. */
  money: { billed: number; released: number } | null;
};

function money(payables: PrismSupplierPayableMilestone[]): BookingCardFacts["money"] {
  if (payables.length === 0) return null;
  return {
    billed: payables.reduce((sum, payable) => sum + payable.amount, 0),
    released: payables.reduce((sum, payable) => sum + payable.amountReleased, 0),
  };
}

function isUrgent(yourTurn: boolean, readiness: PrismSupplierReadinessItem | undefined, todayKey: string): boolean {
  if (readiness?.ingressLate) return true;
  if (!yourTurn || !readiness?.eventDate) return false;
  const days = daysUntil(manilaCalendarKey(readiness.eventDate), todayKey);
  return days !== null && days <= URGENT_WITHIN_DAYS;
}

/** Everything one booking card shows, from the booking, its readiness item and its payouts. */
export function bookingCardFacts(
  request: PrismSupplierQuoteRequest,
  readiness: PrismSupplierReadinessItem | undefined,
  payables: PrismSupplierPayableMilestone[],
  todayKey = manilaDateKey(),
): BookingCardFacts {
  const next = readiness ? supplierNextStep(readiness, true) : { title: "Review booking preparation", owner: YOUR_TURN };
  const steps = buildBookingSteps(request);
  const yourTurn = next.owner === YOUR_TURN;
  return {
    request,
    eventName: readiness?.eventName || "Event details pending",
    eventDate: readiness?.eventDate ?? null,
    next: { title: next.title, owner: next.owner },
    yourTurn,
    urgent: isUrgent(yourTurn, readiness, todayKey),
    steps: { done: steps.filter((step) => step.done).length, total: steps.length },
    money: money(payables.filter((payable) => payable.requestId === request.id)),
  };
}

const dateOf = (card: BookingCardFacts) => card.eventDate ?? "9999";

/** Bookings that wait on the supplier first (urgent ones first, then soonest), then the rest by event date. */
export function orderBookingCards(cards: BookingCardFacts[]): { yours: BookingCardFacts[]; others: BookingCardFacts[] } {
  const yours = cards.filter((card) => card.yourTurn).sort((a, b) => Number(b.urgent) - Number(a.urgent) || dateOf(a).localeCompare(dateOf(b)));
  const others = cards.filter((card) => !card.yourTurn).sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  return { yours, others };
}
