import type { PrismSupplierPayableMilestone, PrismSupplierReadinessItem } from "@prism/types";
import { daysUntil, manilaCalendarKey, manilaDateKey } from "@prism/ui/format-date";
import { supplierNextStep } from "./supplier-next-step";
import { buildBookingSteps } from "./supplier-workspace-rules";
import type { PrismSupplierQuoteRequest } from "./supplier-workspace-types";

const YOUR_TURN = "Your next step";
/** A booking is urgent when it is the supplier's turn and the event is this close, or arrival is already late. */
const URGENT_WITHIN_DAYS = 7;

/** A step that needs no form, so the card can do it in one tap instead of opening the booking. */
export type BookingQuickAction = { kind: "confirm-assignment" } | { kind: "acknowledge-schedule"; revision: number };

export type BookingCardFacts = {
  request: PrismSupplierQuoteRequest;
  eventName: string;
  eventDate: string | null;
  eventType: string | null;
  coverObjectId: string | null;
  next: { title: string; owner: string };
  yourTurn: boolean;
  urgent: boolean;
  /** The event day has passed: the booking moves to Done. */
  done: boolean;
  steps: { done: number; total: number };
  /** When and where to arrive, once PMCM has set a schedule. */
  arrival: { at: string; location: string } | null;
  quickAction: BookingQuickAction | null;
  /** What PMCM agreed to pay on this booking and has released so far; null before a payment schedule exists. */
  money: { billed: number; released: number } | null;
  /** The next payout still to come, soonest first. */
  nextPayout: { amount: number; dueDate: string | null } | null;
};

function money(payables: PrismSupplierPayableMilestone[]): BookingCardFacts["money"] {
  if (payables.length === 0) return null;
  return {
    billed: payables.reduce((sum, payable) => sum + payable.amount, 0),
    released: payables.reduce((sum, payable) => sum + payable.amountReleased, 0),
  };
}

function nextPayout(payables: PrismSupplierPayableMilestone[]): BookingCardFacts["nextPayout"] {
  const open = payables.filter((payable) => payable.remainingBalance > 0)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  return open[0] ? { amount: open[0].remainingBalance, dueDate: open[0].dueDate } : null;
}

/** The same order the next step follows: a late arrival or a contract to fix comes before a one-tap step. */
function quickAction(readiness: PrismSupplierReadinessItem | undefined): BookingQuickAction | null {
  if (!readiness || readiness.quoteStatus !== "selected" || readiness.ingressLate) return null;
  if (readiness.assignmentStatus !== "confirmed") return { kind: "confirm-assignment" };
  if (readiness.contractStatus === "changes_requested" || readiness.contractStatus === "missing") return null;
  if (readiness.schedule && !readiness.schedule.acknowledged) return { kind: "acknowledge-schedule", revision: readiness.schedule.revision };
  return null;
}

function daysAway(readiness: PrismSupplierReadinessItem | undefined, todayKey: string): number | null {
  return readiness?.eventDate ? daysUntil(manilaCalendarKey(readiness.eventDate), todayKey) : null;
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
  const days = daysAway(readiness, todayKey);
  const own = payables.filter((payable) => payable.requestId === request.id);
  return {
    request,
    eventName: readiness?.eventName || "Event details pending",
    eventDate: readiness?.eventDate ?? null,
    eventType: readiness?.eventType ?? null,
    coverObjectId: readiness?.coverObjectId ?? null,
    next: { title: next.title, owner: next.owner },
    yourTurn,
    urgent: Boolean(readiness?.ingressLate) || (yourTurn && days !== null && days <= URGENT_WITHIN_DAYS),
    done: days !== null && days < 0,
    steps: { done: steps.filter((step) => step.done).length, total: steps.length },
    arrival: readiness?.schedule ? { at: readiness.schedule.ingressAt, location: readiness.schedule.location } : null,
    quickAction: quickAction(readiness),
    money: money(own),
    nextPayout: nextPayout(own),
  };
}

const dateOf = (card: BookingCardFacts) => card.eventDate ?? "9999";

/**
 * Bookings that wait on the supplier first (urgent ones first, then soonest), then the rest by event date, then the
 * ones whose event has passed, most recent first.
 */
export function orderBookingCards(cards: BookingCardFacts[]): { yours: BookingCardFacts[]; others: BookingCardFacts[]; done: BookingCardFacts[] } {
  const live = cards.filter((card) => !card.done);
  const yours = live.filter((card) => card.yourTurn).sort((a, b) => Number(b.urgent) - Number(a.urgent) || dateOf(a).localeCompare(dateOf(b)));
  const others = live.filter((card) => !card.yourTurn).sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  const done = cards.filter((card) => card.done).sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  return { yours, others, done };
}
