import {
  CLIENT_PORTAL_VIEW_META,
  PORTAL_ROUTE_TO_NAV_ITEM,
} from "./client-dashboard-navigation";
import type { ClientDashboardRoute, ClientPortalView } from "./client-dashboard-types";

const PORTAL_TITLES: Partial<Record<ClientDashboardRoute, string>> = {
  request: "New event request",
  events: "My events",
  calendar: "Calendar",
  approvals: "Approvals",
  messages: "Messages",
  files: "Files",
  billing: "Billing & Payments",
};

const PORTAL_EYEBROWS: Partial<Record<ClientDashboardRoute, string>> = {
  home: "Client home",
  request: "Signed-in request",
  events: "Event portfolio",
};

const PORTAL_DESCRIPTIONS: Partial<Record<ClientDashboardRoute, string>> = {
  request: "Start another event request using your client account details.",
  events: "Your confirmed PMCM events.",
  calendar: "Event dates, payment due dates, site visits and layout approvals.",
  approvals: "Client approvals grouped by status and document type.",
  messages: "PMCM updates, event conversations, announcements, and archived notes.",
  files: "Contracts, quotations, receipts, layouts, and shared event files.",
  billing: "Quotations, invoices, payment schedule, receipts, and current balance.",
};

const LOADING_TITLES: Partial<Record<ClientDashboardRoute, string>> = {
  request: "New event request",
  events: "My events",
};

const LOADING_DESCRIPTIONS: Partial<Record<ClientDashboardRoute, string>> = {
  request: "Loading event request details…",
  events: "Loading events…",
};

export function isEventScopedClientRoute(route: ClientDashboardRoute, eventId?: string) {
  return Boolean(eventId) || !PORTAL_ROUTE_TO_NAV_ITEM[route];
}

export function clientShellTitle(input: {
  isEventScopedView: boolean;
  eventName?: string;
  portalView?: ClientPortalView;
  route: ClientDashboardRoute;
}) {
  if (input.isEventScopedView) return input.eventName ?? "Client portal";
  if (input.portalView) return CLIENT_PORTAL_VIEW_META[input.portalView].title;
  return PORTAL_TITLES[input.route] ?? "Dashboard";
}

export function clientShellEyebrow(input: { isEventScopedView: boolean; route: ClientDashboardRoute }) {
  if (input.isEventScopedView) return "Event workspace";
  return PORTAL_EYEBROWS[input.route] ?? "Client portal";
}

export function clientShellDescription(input: {
  portalView?: ClientPortalView;
  route: ClientDashboardRoute;
  selectedEvent?: { clientName: string; eventDate: string | null };
}) {
  if (input.portalView) return CLIENT_PORTAL_VIEW_META[input.portalView].description;
  const portalDescription = PORTAL_DESCRIPTIONS[input.route];
  if (portalDescription) return portalDescription;
  if (input.selectedEvent) return `${input.selectedEvent.clientName} - ${input.selectedEvent.eventDate}`;
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
