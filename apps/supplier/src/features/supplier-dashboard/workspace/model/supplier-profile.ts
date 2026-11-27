import type { PrismSupplier, PrismSupplierReadinessItem } from "@prism/types";
import { daysUntil, manilaCalendarKey, manilaDateKey } from "@prism/ui/format-date";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest } from "./supplier-workspace-types";

/**
 * The supplier's inclusions as separate items. PMCM saves them as free text: one per line, or separated by
 * semicolons or bullets; a single line with commas is read as a comma list.
 */
export function serviceInclusionList(text: string): string[] {
  const lines = text.split(/\r?\n|;|•/).map((item) => item.replace(/^[-*\s]+/, "").trim()).filter(Boolean);
  if (lines.length === 1 && lines[0].split(",").length > 2) return lines[0].split(",").map((item) => item.trim()).filter(Boolean);
  return lines;
}

/** The named person PMCM deals with; null when PMCM only has the company name on file. */
export function supplierContactPerson(supplier: Pick<PrismSupplier, "contactName" | "name">): string | null {
  const name = supplier.contactName.trim();
  return name && name.toLowerCase() !== supplier.name.trim().toLowerCase() ? name : null;
}

/** What the supplier has done with PMCM, from their own quotes and bookings only. */
export function supplierTrackRecord(input: {
  quotes: PrismSupplierQuote[];
  bookings: PrismSupplierQuoteRequest[];
  readiness: PrismSupplierReadinessItem[];
  todayKey?: string;
}) {
  const todayKey = input.todayKey ?? manilaDateKey();
  const eventDates = input.bookings
    .map((booking) => input.readiness.find((item) => item.requestId === booking.id)?.eventDate)
    .filter((date): date is string => Boolean(date));
  const past = eventDates.filter((date) => (daysUntil(manilaCalendarKey(date), todayKey) ?? 0) < 0).sort();
  const upcoming = eventDates.filter((date) => (daysUntil(manilaCalendarKey(date), todayKey) ?? -1) >= 0).sort();
  return {
    quotesSent: input.quotes.length,
    bookings: input.bookings.length,
    completed: past.length,
    lastEvent: past.at(-1) ?? null,
    nextEvent: upcoming[0] ?? null,
  };
}
