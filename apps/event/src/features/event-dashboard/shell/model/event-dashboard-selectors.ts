import type { PrismEvent, PrismInquiry } from "@prism/types";

export type EventClientRecord = {
  id: string;
  name: string;
  contact?: string;
  company?: string;
  events: PrismEvent[];
  inquiries: PrismInquiry[];
};

function clientKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "client";
}

export function selectUnreviewedInquiryCount(inquiries: PrismInquiry[]): number {
  return inquiries.filter((inquiry) => inquiry.status === "new").length;
}

function contactKey(inquiry: PrismInquiry) {
  const email = inquiry.email?.trim().toLowerCase();
  return email ? `email:${email}` : `name:${clientKey(inquiry.companyName || inquiry.clientName)}`;
}

/**
 * One record per client contact. Inquiries group by the contact's email, the identity their client
 * account is created from. Events join the record of the inquiry they came from (`inquiryId`), so an
 * event never splits from its client because the event's display name differs from the inquiry's.
 * Events without a known inquiry fall back to their client name.
 */
export function selectClientRecords(events: PrismEvent[], inquiries: PrismInquiry[]): EventClientRecord[] {
  const byContact = new Map<string, EventClientRecord>();
  const contactByInquiry = new Map<string, string>();
  const usedIds = new Set<string>();

  function uniqueId(name: string) {
    const base = clientKey(name);
    let id = base;
    for (let n = 2; usedIds.has(id); n += 1) id = `${base}-${n}`;
    usedIds.add(id);
    return id;
  }

  inquiries.forEach((inquiry) => {
    const key = contactKey(inquiry);
    contactByInquiry.set(inquiry.id, key);
    const current = byContact.get(key);
    if (current) {
      current.inquiries.push(inquiry);
      return;
    }
    const name = inquiry.companyName || inquiry.clientName;
    byContact.set(key, { id: uniqueId(name), name, contact: inquiry.clientName, company: inquiry.companyName, events: [], inquiries: [inquiry] });
  });

  events.forEach((event) => {
    const key = (event.inquiryId && contactByInquiry.get(event.inquiryId)) || `name:${clientKey(event.clientName)}`;
    const current = byContact.get(key);
    if (current) {
      current.events.push(event);
      return;
    }
    byContact.set(key, { id: uniqueId(event.clientName), name: event.clientName, contact: event.clientName, events: [event], inquiries: [] });
  });

  return Array.from(byContact.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function selectClientRecordsForView(records: EventClientRecord[], view: string): EventClientRecord[] {
  switch (view) {
    case "active":
      return records.filter((client) => client.events.length > 0);
    case "prospects":
      return records.filter((client) => client.inquiries.length > 0 && client.events.length === 0);
    case "past":
      return records.filter((client) =>
        client.events.some((event) => /completed|closed|archived/i.test(event.status)),
      );
    case "archived":
      return records.filter(
        (client) => client.events.length > 0 && client.events.every((event) => event.archived),
      );
    default:
      return records;
  }
}

export function selectEventsForView(events: PrismEvent[], view: string): PrismEvent[] {
  switch (view) {
    case "upcoming":
      return events.filter((event) => new Date(event.eventDate).getTime() >= Date.now());
    case "ongoing":
      return events.filter((event) =>
        /planning|active|ongoing|in_progress|confirmed/i.test(event.status),
      );
    case "completed":
      return events.filter((event) => /completed|closed/i.test(event.status));
    case "cancelled":
      return events.filter((event) => /cancel/i.test(event.status));
    case "draft":
      return events.filter((event) => /draft/i.test(event.status));
    default:
      return events;
  }
}

const NOT_STARTABLE_STATUSES = new Set(["event_day", "cancelled", "postponed", "date_to_be_confirmed", "archived"]);

/** Mirrors the API start-event-day guard: unlocked (signed conforme), approved official floorplan, not ended or archived. */
export function canStartEventDay(event: PrismEvent): boolean {
  return (
    !event.archived &&
    !event.actualEndedAt &&
    !NOT_STARTABLE_STATUSES.has(event.status) &&
    event.clientPortalStatus === "unlocked" &&
    event.floorPlanStatus === "approved"
  );
}
