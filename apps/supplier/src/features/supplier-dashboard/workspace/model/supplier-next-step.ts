import type { PrismSupplierReadinessItem } from "@prism/types";
import { daysUntil, manilaCalendarKey, manilaDateKey } from "@prism/ui/format-date";
import { readinessDeadline, supplierReadinessSection } from "./supplier-workspace-rules";
import { supplierWorkTargetHref } from "./supplier-workspace-types";

const CLOSED_QUOTE_STATUSES = ["closed", "cancelled", "expired"];
const WAITING_FOR_PMCM = "Waiting for PMCM";

export function supplierWorkHref(item: Pick<PrismSupplierReadinessItem, "quoteStatus" | "requestId">) {
  return supplierWorkTargetHref(supplierReadinessSection(item) === "bookings" ? "bookings" : "requests", item.requestId);
}

export function supplierBookingHref(requestId: string) {
  return supplierWorkTargetHref("bookings", requestId);
}

function quoteNextStep(item: PrismSupplierReadinessItem, hasQuote: boolean) {
    if (CLOSED_QUOTE_STATUSES.includes(item.quoteStatus)) return { title: "Request closed", detail: "Review the request and any quote you submitted.", action: "View request", owner: "For reference" };
    return hasQuote
      ? { title: "Quote submitted", detail: "PMCM will review your offer. Submitting a quote does not confirm a booking.", action: "Review your quote", owner: WAITING_FOR_PMCM }
      : { title: "Prepare your quote", detail: "Review the requested scope, price your services and send your offer to PMCM.", action: "Review request", owner: "Your next step" };
}

/** Today separates work the supplier can move now from work with PMCM; closed requests drop off. Soonest first. */
export function splitSupplierNextSteps(items: PrismSupplierReadinessItem[], hasQuote: (item: PrismSupplierReadinessItem) => boolean) {
  const live = items
    .filter((item) => !CLOSED_QUOTE_STATUSES.includes(item.quoteStatus))
    .sort((left, right) => readinessDeadline(left) - readinessDeadline(right));
  const waiting = (item: PrismSupplierReadinessItem) => supplierNextStep(item, hasQuote(item)).owner === WAITING_FOR_PMCM;
  return { yourTurn: live.filter((item) => !waiting(item)), waiting: live.filter(waiting) };
}

export function supplierNextStep(item: PrismSupplierReadinessItem, hasQuote: boolean) {
  if (item.quoteStatus !== "selected") return quoteNextStep(item, hasQuote);
  if (item.ingressLate) return { title: "Arrival update needed", detail: "Your scheduled arrival time has passed without an arrival report.", action: "Update arrival status", owner: "Your next step" };
  if (item.assignmentStatus !== "confirmed") return { title: "Confirm your booking", detail: "PMCM selected your quote. Confirm that you can take on the assignment.", action: "Review booking", owner: "Your next step" };
  if (item.contractStatus === "changes_requested") return { title: "Correct your contract", detail: "PMCM requested changes. Review the feedback before uploading a new version.", action: "Review contract feedback", owner: "Your next step" };
  if (item.contractStatus === "missing") return { title: "Upload your signed contract", detail: "PMCM needs your signed contract for review.", action: "Open booking documents", owner: "Your next step" };
  if (item.schedule && !item.schedule.acknowledged) return { title: "Acknowledge your schedule", detail: "Review the latest arrival, departure and location details.", action: "Review schedule", owner: "Your next step" };
  if (item.readinessStatus !== "confirmed") return { title: "Confirm your readiness", detail: "Check the booking requirements and tell PMCM when your preparation is complete.", action: "Review preparation", owner: "Your next step" };
  if (item.contractStatus === "submitted") return { title: "Contract awaiting review", detail: "PMCM is reviewing your contract. Your schedule and event-day controls remain in the booking.", action: "View booking", owner: WAITING_FOR_PMCM };
  return { title: "Keep PMCM updated", detail: "Review the schedule and report arrival, setup or departure as it happens.", action: "Open booking", owner: "Event-day updates" };
}

/**
 * The one number the Today lead shows: days overdue or left on a quote deadline while bidding,
 * otherwise days to the event. Counted in Philippine calendar days, as every date in the portal is.
 * Nothing when the item has no usable date.
 */
export function supplierStepFigure(
  item: Pick<PrismSupplierReadinessItem, "quoteStatus" | "dueAt" | "eventDate">,
  now = new Date(),
): { value: string; label: string } | undefined {
  const today = manilaDateKey(now);
  const daysTo = (value: string | null | undefined) => (value && Number.isFinite(new Date(value).getTime()) ? daysUntil(manilaCalendarKey(value), today) : null);
  const due = item.quoteStatus === "selected" ? null : daysTo(item.dueAt);
  if (due !== null && item.dueAt) {
    if (new Date(item.dueAt).getTime() < now.getTime()) {
      const late = Math.max(1, -due);
      return { value: String(late), label: late === 1 ? "day overdue" : "days overdue" };
    }
    return due <= 0 ? { value: "Today", label: "Quote due" } : { value: String(due), label: due === 1 ? "day left" : "days left" };
  }
  const toGo = daysTo(item.eventDate);
  if (toGo === null || toGo < 0) return undefined;
  return toGo === 0 ? { value: "Today", label: "Event day" } : { value: String(toGo), label: toGo === 1 ? "day to event" : "days to event" };
}

/** One line under the Today title: how much is the supplier's to do and how much sits with PMCM. */
export function supplierTodaySummary(yourTurn: number, waiting: number): string {
  const parts = [
    yourTurn === 0 ? "Nothing needs you right now" : yourTurn === 1 ? "1 thing needs you" : `${yourTurn} things need you`,
    waiting ? `${waiting} waiting on PMCM` : null,
  ].filter(Boolean);
  return `${parts.join(" · ")}.`;
}
