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

export function selectClientRecords(events: PrismEvent[], inquiries: PrismInquiry[]): EventClientRecord[] {
  const map = new Map<string, EventClientRecord>();

  inquiries.forEach((inquiry) => {
    const name = inquiry.companyName || inquiry.clientName;
    const id = clientKey(name);
    const current = map.get(id) ?? {
      id,
      name,
      contact: inquiry.clientName,
      company: inquiry.companyName,
      events: [],
      inquiries: [],
    };
    current.inquiries.push(inquiry);
    map.set(id, current);
  });

  events.forEach((event) => {
    const id = clientKey(event.clientName);
    const current = map.get(id) ?? {
      id,
      name: event.clientName,
      contact: event.clientName,
      events: [],
      inquiries: [],
    };
    current.events.push(event);
    map.set(id, current);
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
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

// Re-export workspace selectors for shell composition convenience.
// Imported via the feature barrel, not the internal model/ file — see
// docs/reviews/2026-09-01-fe-be-architecture-alignment.md (finding F1).
export {
  selectActiveEvents,
  selectEventWorkspaceResources,
  selectPendingApprovals,
  selectSelectedEvent,
  selectSelectedEventWorkspaceResources,
} from "@/features/event-workspace/shell";

// Re-export command-inbox selectors for shell composition convenience.
export {
  selectCommandInboxGroupedBySeverity,
  selectCommandInboxItemsBySeverity,
} from "@/features/command-inbox/list";
