import type { PrismSupplierReadinessItem } from "@prism/types";
import { daysUntil, manilaCalendarKey, manilaDateKey } from "@prism/ui/format-date";
import { isQuoteLocked, isRequestClosed } from "./supplier-workspace-rules";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest } from "./supplier-workspace-types";

/** Where one request stands for the supplier: theirs to price, sent and with PMCM, or over. */
export type RequestStage = "to-quote" | "sent" | "closed";

/** How loud a deadline is: past it or within three days is worth the eye. */
export type DeadlineTone = "overdue" | "soon" | "later";

const SOON_DAYS = 3;

export type RequestCardFacts = {
  request: PrismSupplierQuoteRequest;
  quote: PrismSupplierQuote | undefined;
  stage: RequestStage;
  eventName: string;
  eventDate: string | null;
  eventType: string | null;
  coverObjectId: string | null;
  /** The quote deadline as the card says it ("Due in 3 days", "Overdue 2 days"); null without a live deadline. */
  deadline: { label: string; tone: DeadlineTone; days: number } | null;
  /** The one-line state under the card's title. */
  status: { owner: string; title: string };
  /** What the card's button does. */
  action: "Prepare quote" | "Revise quote" | "View quote" | "View request";
  /** The supplier can still send a revision. */
  canRevise: boolean;
};

const dayWord = (days: number) => (days === 1 ? "1 day" : `${days} days`);

function deadline(dueDate: string | null | undefined, stage: RequestStage, now: Date): RequestCardFacts["deadline"] {
  if (!dueDate || stage === "closed") return null;
  const days = daysUntil(manilaCalendarKey(dueDate), manilaDateKey(now));
  if (days === null) return null;
  const passed = new Date(dueDate).getTime() < now.getTime();
  if (passed || days < 0) return { label: days < 0 ? `Overdue ${dayWord(-days)}` : "Overdue", tone: "overdue", days };
  if (days === 0) return { label: "Due today", tone: "soon", days };
  return { label: `Due in ${dayWord(days)}`, tone: days <= SOON_DAYS ? "soon" : "later", days };
}

function closedTitle(request: PrismSupplierQuoteRequest, quote: PrismSupplierQuote | undefined) {
  if (quote?.status === "not_selected") return "Not selected";
  if (request.status === "expired") return quote ? "Deadline passed" : "Deadline passed without a quote";
  return "Request closed";
}

/** Everything one request card shows, from the request, the supplier's quote and its readiness item. */
export function requestCardFacts(
  request: PrismSupplierQuoteRequest,
  quote: PrismSupplierQuote | undefined,
  readiness: PrismSupplierReadinessItem | undefined,
  now = new Date(),
): RequestCardFacts {
  const closed = isRequestClosed(request, quote);
  const stage: RequestStage = closed ? "closed" : quote ? "sent" : "to-quote";
  const canRevise = stage === "sent" && !isQuoteLocked(request, quote);
  return {
    request,
    quote,
    stage,
    eventName: readiness?.eventName || (request.confidentialBid ? "Confidential event" : "Event details pending"),
    eventDate: readiness?.eventDate ?? null,
    eventType: readiness?.eventType ?? null,
    coverObjectId: readiness?.coverObjectId ?? null,
    deadline: deadline(request.dueDate, stage, now),
    canRevise,
    ...stageCopy(stage, canRevise, request, quote),
  };
}

/** The card's state line and button for each stage. */
function stageCopy(stage: RequestStage, canRevise: boolean, request: PrismSupplierQuoteRequest, quote: PrismSupplierQuote | undefined): Pick<RequestCardFacts, "status" | "action"> {
  if (stage === "to-quote") return { status: { owner: "Your next step", title: "Not quoted yet" }, action: "Prepare quote" };
  if (stage === "sent") {
    return {
      status: { owner: "Sent · waiting for PMCM", title: canRevise ? "1 revision left" : "Final version" },
      action: canRevise ? "Revise quote" : "View quote",
    };
  }
  return { status: { owner: "Closed", title: closedTitle(request, quote) }, action: quote ? "View quote" : "View request" };
}

const dueOf = (card: RequestCardFacts) => card.request.dueDate ?? "9999";

/**
 * Requests to price first (soonest deadline first), then quotes PMCM is reviewing (soonest deadline first), then
 * closed requests, most recent first.
 */
export function orderRequestCards(cards: RequestCardFacts[]): Record<RequestStage, RequestCardFacts[]> {
  const byDue = (a: RequestCardFacts, b: RequestCardFacts) => dueOf(a).localeCompare(dueOf(b));
  return {
    "to-quote": cards.filter((card) => card.stage === "to-quote").sort(byDue),
    sent: cards.filter((card) => card.stage === "sent").sort(byDue),
    closed: cards.filter((card) => card.stage === "closed").sort((a, b) => byDue(b, a)),
  };
}

/** The payment terms suppliers most often send, offered as one-tap fills on the quote form. */
export const COMMON_PAYMENT_TERMS = [
  "50% upon confirmation; balance after the event",
  "50% deposit; balance on the event day",
  "Full payment after the event",
] as const;
