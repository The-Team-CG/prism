import { formatPortalDate } from "@prism/ui/format-date";
import {
  CLIENT_PORTAL_VIEW_META,
  PORTAL_ROUTE_TO_NAV_ITEM,
} from "./client-dashboard-navigation";
import type { ClientDashboardRoute, ClientPortalView } from "./client-dashboard-types";

const PORTAL_TITLES: Partial<Record<ClientDashboardRoute, string>> = {
  request: "New event request",
  "shared-floorplans": "Shared floorplans",
  events: "My events",
  calendar: "Calendar",
  messages: "Messages",
  files: "Files",
  billing: "Billing & Payments",
  privacy: "Privacy",
  account: "Account",
  notifications: "Notifications",
};

const PORTAL_EYEBROWS: Partial<Record<ClientDashboardRoute, string>> = {
  home: "Client home",
  request: "Signed-in request",
  events: "Event portfolio",
};

const PORTAL_DESCRIPTIONS: Partial<Record<ClientDashboardRoute, string>> = {
  request: "Start another event request using your client account details.",
  events: "Your confirmed PMCM events.",
  "shared-floorplans": "Official layouts PMCM has shared with you, read-only.",
  calendar: "Event dates, payment due dates, change deadlines and site visits.",
  messages: "PMCM updates, event conversations, announcements, and archived notes.",
  files: "Contracts, quotations, receipts, layouts, and shared event files.",
  billing: "Quotations, invoices, payment schedule, receipts, and current balance.",
  privacy: "Ask PMCM about your personal data and follow each request to its outcome.",
  account: "Who you are, how you sign in, and where PMCM reaches you.",
  notifications: "What changed across your events, what is new since you last looked, and what PMCM asked you to confirm.",
};

const LOADING_TITLES: Partial<Record<ClientDashboardRoute, string>> = {
  request: "New event request",
  events: "My events",
};

const LOADING_DESCRIPTIONS: Partial<Record<ClientDashboardRoute, string>> = {
  request: "Loading event request details…",
  events: "Loading events…",
};

/** The section an event workspace route shows, so each event tab's H1 names the section rather than the event. */
const EVENT_SECTION_LABELS: Partial<Record<ClientDashboardRoute, string>> = {
  overview: "Overview",
  actions: "Actions",
  details: "Details",
  progress: "Planning",
  schedule: "Schedule",
  guests: "Guest access",
  preferences: "Preferences",
  briefing: "Briefing",
  proposal: "Proposal",
  floorplan: "Floor plan",
  documents: "Files",
  files: "Files",
  billing: "Billing",
  payments: "Billing",
  messages: "Messages",
  changes: "Changes",
  summary: "Closeout & feedback",
};

/** Portal parent for the breadcrumb. The trail always ends with the current page. */
const PORTAL_TRAIL_PARENT: Partial<Record<ClientDashboardRoute, string>> = {
  home: "Home",
  "shared-floorplans": "Shared floorplans",
  request: "New event request",
  events: "Events",
  calendar: "Calendar",
  messages: "Messages",
  files: "Files",
  billing: "Billing & Payments",
  privacy: "Privacy",
  account: "Account",
  notifications: "Notifications",
};

export function isEventScopedClientRoute(route: ClientDashboardRoute, eventId?: string) {
  return Boolean(eventId) || !PORTAL_ROUTE_TO_NAV_ITEM[route];
}

export function clientEventSectionLabel(route: ClientDashboardRoute) {
  return EVENT_SECTION_LABELS[route] ?? "Overview";
}

export function clientShellTitle(input: {
  isEventScopedView: boolean;
  portalView?: ClientPortalView;
  route: ClientDashboardRoute;
}) {
  if (input.isEventScopedView) return clientEventSectionLabel(input.route);
  if (input.portalView) return CLIENT_PORTAL_VIEW_META[input.portalView].title;
  return PORTAL_TITLES[input.route] ?? "Home";
}

const WIDE_CLIENT_ROUTES: ReadonlySet<ClientDashboardRoute> = new Set(["floorplan", "calendar", "messages"]);

/**
 * How the shell frames a page: wide routes use the full width, others a reading column. An event's overview leads
 * with the event itself at full width, so the page title above it is kept for screen readers only.
 */
export function clientShellLayout(input: { isEventScopedView: boolean; route: ClientDashboardRoute; hasEvent: boolean }) {
  const eventLeads = input.isEventScopedView && input.route === "overview" && input.hasEvent;
  return {
    titleClassName: eventLeads ? "sr-only" : undefined,
    contentClassName: eventLeads || WIDE_CLIENT_ROUTES.has(input.route) ? "space-y-5" : "max-w-5xl space-y-5",
  };
}

export function clientShellEyebrow(input: { isEventScopedView: boolean; route: ClientDashboardRoute }) {
  if (input.isEventScopedView) return "Event workspace";
  return PORTAL_EYEBROWS[input.route] ?? "Client portal";
}

/**
 * Breadcrumb after the role label. Event workspaces trail "My events" and the section; the event name
 * stays in the description and the sidebar switcher, where it can truncate with a tooltip.
 */
export function clientBreadcrumbTrail(input: {
  isEventScopedView: boolean;
  portalView?: ClientPortalView;
  route: ClientDashboardRoute;
}): string[] {
  if (input.isEventScopedView) return ["My events", clientEventSectionLabel(input.route)];
  const parent = PORTAL_TRAIL_PARENT[input.route] ?? "Home";
  const current = input.portalView ? CLIENT_PORTAL_VIEW_META[input.portalView].title : undefined;
  return current && current !== parent ? [parent, current] : [parent];
}

export function clientShellDescription(input: {
  isEventScopedView: boolean;
  portalView?: ClientPortalView;
  route: ClientDashboardRoute;
  selectedEvent?: { eventName: string; eventDate: string | null };
}) {
  if (input.isEventScopedView) {
    return input.selectedEvent
      ? `${input.selectedEvent.eventName} · ${formatPortalDate(input.selectedEvent.eventDate)}`
      : "Loading event workspace…";
  }
  // Home opens with its own greeting and summary line, so the shell adds no second description.
  if (input.route === "home" && (!input.portalView || input.portalView === "dashboard-overview")) return undefined;
  if (input.portalView) return CLIENT_PORTAL_VIEW_META[input.portalView].description;
  const portalDescription = PORTAL_DESCRIPTIONS[input.route];
  if (portalDescription) return portalDescription;
  return "Portal opens after inquiry is accepted and conforme is signed.";
}

export function clientLoadingShellCopy(input: {
  portalView?: ClientPortalView;
  route: ClientDashboardRoute;
}) {
  const portalMeta = input.portalView ? CLIENT_PORTAL_VIEW_META[input.portalView] : undefined;
  return {
    title: portalMeta?.title ?? LOADING_TITLES[input.route] ?? "Client portal",
    eyebrow: PORTAL_EYEBROWS[input.route] ?? "Event workspace",
    description: portalMeta?.description ?? LOADING_DESCRIPTIONS[input.route] ?? "Loading event workspace…",
  };
}
