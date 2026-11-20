import type { PrismEvent, PrismInquiry, PrismPmcmClientEventFacts } from "@prism/types";
import type { EventClientRecord } from "./event-dashboard-selectors";

const CLOSED_EVENT_STATUSES = ["completed", "cancelled", "closed"];

/** Still being worked: not archived and not completed, cancelled or closed. */
export function isOpenClientEvent(event: Pick<PrismEvent, "archived" | "status">): boolean {
  return !event.archived && !CLOSED_EVENT_STATUSES.includes(event.status);
}

/** Inquiries that still need a decision or are on hold, as opposed to settled history. */
function isOpenInquiry(inquiry: Pick<PrismInquiry, "status">): boolean {
  return inquiry.status === "new" || inquiry.status === "pending_review" || inquiry.status === "pending";
}

export type ClientYear = { year: string; events: PrismEvent[]; inquiries: PrismInquiry[] };

export type ClientDossierSummary = {
  /** Events still being worked, soonest first. */
  active: PrismEvent[];
  /** Inquiries still waiting on a decision, newest first. */
  openInquiries: PrismInquiry[];
  /** Everything else, folded by the year of the event date, newest year first. */
  history: ClientYear[];
  figures: { events: number; upcoming: number; completed: number; inquiries: number };
  /** The first time the client reached PMCM: their earliest inquiry or event. */
  since: string | null;
};

const yearOf = (date: string | null | undefined) => (date && /^\d{4}/.test(date) ? date.slice(0, 4) : "Undated");

/**
 * One client's relationship with PMCM: what is active now, what waits on a decision, and the rest of their history
 * folded by year. A long-standing client otherwise listed every past event and inquiry in one column (70 inquiries
 * and 14,000px on a phone).
 */
export function summarizeClientDossier(client: Pick<EventClientRecord, "events" | "inquiries">, todayKey: string): ClientDossierSummary {
  const active = client.events.filter(isOpenClientEvent).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const openInquiries = client.inquiries.filter(isOpenInquiry).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeIds = new Set(active.map((event) => event.id));
  const openIds = new Set(openInquiries.map((inquiry) => inquiry.id));
  const years = new Map<string, ClientYear>();
  const bucket = (year: string) => {
    const entry = years.get(year) ?? { year, events: [], inquiries: [] };
    years.set(year, entry);
    return entry;
  };
  for (const event of client.events) if (!activeIds.has(event.id)) bucket(yearOf(event.eventDate)).events.push(event);
  for (const inquiry of client.inquiries) if (!openIds.has(inquiry.id)) bucket(yearOf(inquiry.eventDate)).inquiries.push(inquiry);
  for (const year of years.values()) {
    year.events.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
    year.inquiries.sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));
  }
  const history = [...years.values()].sort((a, b) => (a.year === "Undated" ? 1 : b.year === "Undated" ? -1 : b.year.localeCompare(a.year)));
  const dates = [...client.inquiries.map((inquiry) => inquiry.createdAt), ...client.events.map((event) => event.eventDate)].filter(Boolean).sort();
  return {
    active,
    openInquiries,
    history,
    figures: {
      events: client.events.length,
      upcoming: active.filter((event) => event.eventDate.slice(0, 10) >= todayKey).length,
      completed: client.events.filter((event) => !isOpenClientEvent(event) && event.status !== "cancelled").length,
      inquiries: client.inquiries.length,
    },
    since: dates[0] ?? null,
  };
}

export type ClientLifetime = {
  /** Current payment milestones across every event the client has had with PMCM, in pesos. */
  billed: number;
  /** The mean of the closeout ratings the client sent, to one decimal, or null before any. */
  averageRating: number | null;
  ratings: number;
  /** The client's latest portal sign-in across their events. */
  lastActiveAt: string | null;
};

/** What the client has been worth to PMCM and how recently they were around, from the per-event facts. */
export function clientLifetime(eventIds: readonly string[], facts: ReadonlyArray<PrismPmcmClientEventFacts> | undefined): ClientLifetime | undefined {
  if (!facts) return undefined;
  const ids = new Set(eventIds);
  const mine = facts.filter((fact) => ids.has(fact.eventId));
  const ratings = mine.map((fact) => fact.closeoutRating).filter((rating): rating is number => typeof rating === "number");
  const lastActiveAt = mine.map((fact) => fact.clientLastActiveAt).filter((at): at is string => Boolean(at)).sort().at(-1) ?? null;
  return {
    billed: mine.reduce((sum, fact) => sum + fact.billed, 0),
    averageRating: ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : null,
    ratings: ratings.length,
    lastActiveAt,
  };
}
