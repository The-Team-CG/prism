import type { PrismCommandGroup, PrismPageAction } from "@prism/ui";
import type { PrismEvent, PrismInquiry } from "@prism/types";
import { formatPortalDate } from "@prism/ui/format-date";
import type { DetailTab } from "./event-dashboard-routing";
import type { EventClientRecord } from "./event-dashboard-selectors";

/** Every event workspace tab the palette can open directly, in the order the event tab strip shows them. */
export const PALETTE_EVENT_TABS: ReadonlyArray<{ tab: DetailTab; label: string }> = [
  { tab: "overview", label: "Overview" },
  { tab: "briefing", label: "Briefing" },
  { tab: "floorplans", label: "Floorplans" },
  { tab: "suppliers", label: "Suppliers" },
  { tab: "registration", label: "Registration" },
  { tab: "games", label: "Games" },
  { tab: "coordinators", label: "Coordinators" },
  { tab: "live-ops", label: "Live ops" },
  { tab: "billing", label: "Billing" },
  { tab: "closure", label: "Closure" },
  { tab: "decisions", label: "Decisions" },
  { tab: "files", label: "Files" },
  { tab: "messages", label: "Messages" },
];

export type PmcmCommandTargets = {
  openEvent: (eventId: string, tab: DetailTab) => void;
  openClient: (clientId: string) => void;
  openInquiry: (inquiry: PrismInquiry) => void;
};

/** The intake log filtered to one inquiry's client, with every status shown so the record is never hidden by default. */
export function inquiryLogHref(inquiry: Pick<PrismInquiry, "clientName">): string {
  const params = new URLSearchParams({ q: inquiry.clientName, inquiryStatus: "all" });
  return `/dashboard/inquiries?${params.toString()}`;
}

function eventAction(event: PrismEvent, tab: DetailTab, targets: PmcmCommandTargets): PrismPageAction {
  return {
    id: `event:${event.id}`,
    label: event.eventName,
    description: `${formatPortalDate(event.eventDate)} · ${event.clientName}`,
    onSelect: () => targets.openEvent(event.id, tab),
  };
}

function eventSectionActions(events: PrismEvent[], targets: PmcmCommandTargets): PrismPageAction[] {
  return events.flatMap((event) =>
    PALETTE_EVENT_TABS.map(({ tab, label }) => ({
      id: `event-tab:${event.id}:${tab}`,
      label: `${label} — ${event.eventName}`,
      description: formatPortalDate(event.eventDate),
      onSelect: () => targets.openEvent(event.id, tab),
    })),
  );
}

/**
 * Ctrl K records for PMCM: events, clients, inquiries and each event's workspace sections. Built only from the
 * reference data the shell already holds. Every group stays hidden until the person types, so an empty palette
 * still shows just the pages.
 */
export function buildPmcmCommandGroups(
  { events, clients, inquiries }: { events: PrismEvent[]; clients: EventClientRecord[]; inquiries: PrismInquiry[] },
  targets: PmcmCommandTargets,
): PrismCommandGroup[] {
  return [
    { heading: "Events", whenSearching: true, actions: events.map((event) => eventAction(event, "overview", targets)) },
    {
      heading: "Clients",
      whenSearching: true,
      actions: clients.map((client) => ({
        id: `client:${client.id}`,
        label: client.name,
        description: `${client.events.length} ${client.events.length === 1 ? "event" : "events"} · ${client.inquiries.length} ${client.inquiries.length === 1 ? "inquiry" : "inquiries"}`,
        onSelect: () => targets.openClient(client.id),
      })),
    },
    {
      heading: "Inquiries",
      whenSearching: true,
      actions: inquiries.map((inquiry) => ({
        id: `inquiry:${inquiry.id}`,
        label: inquiry.clientName,
        description: `${inquiry.eventName} · ${inquiry.status}`,
        onSelect: () => targets.openInquiry(inquiry),
      })),
    },
    { heading: "Event sections", whenSearching: true, actions: eventSectionActions(events, targets) },
  ];
}
