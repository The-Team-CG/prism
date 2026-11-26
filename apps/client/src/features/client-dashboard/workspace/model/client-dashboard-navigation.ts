import {
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FileText,
  Home,
  LayoutGrid,
  MapPinned,
  MessageSquareText,
  PackageCheck,
  ShieldCheck,
  Bell,
  TicketCheck,
  UserRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import type { ClientDashboardRoute, ClientPortalView, ClientSidebarLink, ClientSidebarNavItem, ClientSidebarSubItem, DetailTab } from "./client-dashboard-types";
import type { PrismAccountMenuItem, PrismMobileBar } from "@prism/ui";
import { PRISM_NAV_ICONS } from "@prism/ui/nav-icons";
import type { PrismEvent } from "@prism/types";
import { isPastClientEvent, orderClientEvents } from "../../home/model/client-home-summary";

export const CLIENT_CONFORME_REVIEW_HREF = "/conforme";

export const CLIENT_SIDEBAR_ITEMS: ClientSidebarNavItem[] = [
  {
    id: "client-dashboard",
    label: "Home",
    icon: Home,
    section: "Client Portal",
    route: "home",
  },
  {
    id: "my-events",
    label: "Events",
    icon: PRISM_NAV_ICONS.Events,
    section: "Client Portal",
    route: "events",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarDays,
    section: "Client Portal",
    route: "calendar",
  },
  {
    id: "messages",
    label: "Messages",
    icon: MessageSquareText,
    section: "Client Portal",
    route: "messages",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    section: "Client Portal",
    route: "notifications",
  },
  {
    id: "files",
    label: "Files",
    icon: FileText,
    section: "Client Portal",
    route: "files",
  },
  {
    id: "billing-payments",
    label: "Billing & Payments",
    shortLabel: "Billing",
    icon: WalletCards,
    section: "Client Portal",
    route: "billing",
  },
];

/** Account-level entries that only forward into one event's section when the client has a single event. */
const EVENT_OWNED_SIDEBAR_IDS = new Set(["messages", "files", "billing-payments"]);

/**
 * With one event, Messages, Files and Billing would each bounce into that event's own tab, so
 * the portal sidebar keeps Home, Events and Calendar and the event workspace carries the rest.
 */
export function clientPortalSidebarItems(eventCount: number): ClientSidebarNavItem[] {
  return eventCount > 1 ? CLIENT_SIDEBAR_ITEMS : CLIENT_SIDEBAR_ITEMS.filter((item) => !EVENT_OWNED_SIDEBAR_IDS.has(item.id));
}

/**
 * The phone bar outside an event: Home, Events, Calendar and Billing, with messages and notifications in the top bar
 * and files and the upcoming events under More. With one event, the pages that event carries drop out on their own.
 */
export const CLIENT_PORTAL_MOBILE_BAR: PrismMobileBar = {
  tabs: ["client-dashboard", "my-events", "calendar", "billing-payments"],
  header: ["messages", "notifications"],
};

/**
 * The phone bar inside one event: what the client checks most, with the event's messages in the top bar and the rest
 * of the workspace under More. The event switch in the top bar is the way back to all events.
 */
export const CLIENT_EVENT_MOBILE_BAR: PrismMobileBar = {
  tabs: ["event-overview", "event-progress", "event-proposal", "event-billing"],
  header: ["event-messages"],
};

/**
 * Before the conforme the client portal is limited (UAT 4.1, 5.3): the client answers the briefing, reviews the
 * proposal and messages PMCM. The rest of the workspace opens once the signed conforme activates the portal.
 */
export const LIMITED_PORTAL_ROUTES: readonly ClientDashboardRoute[] = ["overview", "briefing", "proposal", "messages"];

/** Whether an event's portal shows this route; a limited portal shows only the briefing-and-proposal pages. */
export function isClientRouteOpen(route: ClientDashboardRoute, event?: Partial<Pick<PrismEvent, "clientPortalStatus">> | null): boolean {
  return event?.clientPortalStatus !== "limited" || LIMITED_PORTAL_ROUTES.includes(route);
}

/** The phone bar inside an event whose portal is still limited to the briefing and proposal. */
export const CLIENT_LIMITED_EVENT_MOBILE_BAR: PrismMobileBar = {
  tabs: ["event-overview", "event-briefing", "event-proposal"],
  header: ["event-messages"],
};

export const EVENT_WORKSPACE_NAV_ITEMS: ClientSidebarSubItem[] = [
  { id: "event-overview", label: "Overview", route: "overview", requiresEvent: true, eventScoped: true },
  { id: "event-progress", label: "Planning", route: "progress", requiresEvent: true, eventScoped: true },
  { id: "event-briefing", label: "Briefing", route: "briefing", requiresEvent: true, eventScoped: true },
  { id: "event-proposal", label: "Proposal", route: "proposal", requiresEvent: true, eventScoped: true },
  { id: "event-guests", label: "Guest access", route: "guests", requiresEvent: true, eventScoped: true },
  { id: "event-floorplan", label: "Floor plan", route: "floorplan", requiresEvent: true, eventScoped: true },
  { id: "event-billing", label: "Billing", route: "billing", requiresEvent: true, eventScoped: true },
  { id: "event-files", label: "Files", route: "documents", requiresEvent: true, eventScoped: true },
  { id: "event-messages", label: "Messages", route: "messages", requiresEvent: true, eventScoped: true },
  { id: "event-closeout", label: "Closeout & feedback", route: "summary", requiresEvent: true, eventScoped: true },
];

const EVENT_NAV_ICONS: Record<string, LucideIcon> = {
  "event-overview": LayoutGrid,
  "event-progress": ClipboardList,
  "event-briefing": PRISM_NAV_ICONS.Briefing,
  "event-guests": TicketCheck,
  "event-floorplan": MapPinned,
  "event-proposal": FileSignature,
  "event-billing": WalletCards,
  "event-files": FileText,
  "event-messages": MessageSquareText,
  "event-closeout": PackageCheck,
};

/**
 * Inside one event the sidebar is that event's workspace instead of the portal sidebar plus a second
 * row of tabs. The event switcher above names the event and carries the way back to all events, so
 * the pages sit in the unlabelled portal group.
 */
export function clientEventSidebarItems(eventId?: string, event?: Pick<PrismEvent, "actualEndedAt" | "archived"> & Partial<Pick<PrismEvent, "clientPortalStatus">>) {
  const closeoutAvailable = Boolean(event?.actualEndedAt || event?.archived);
  const eventItems = EVENT_WORKSPACE_NAV_ITEMS.filter((item) =>
    (event?.archived ? item.route === "summary" : item.route !== "summary" || closeoutAvailable)
    && (!item.route || isClientRouteOpen(item.route, event)),
  );
  return eventItems.map((item) => ({
    id: item.id,
    label: item.label,
    icon: EVENT_NAV_ICONS[item.id] ?? LayoutGrid,
    section: "Client Portal",
    href: eventId ? dashboardHref(item.route, eventId) : undefined,
  }));
}

const OPEN_EVENT_NAV_PREFIX = "open-event:";
const OPEN_EVENT_NAV_LIMIT = 4;

/**
 * Outside an event the portal sidebar lists the client's upcoming events, soonest first, so any page
 * is one click from an event and the name clicked is the one the event switcher then shows.
 * The Events page holds the full list, so this stays short.
 */
export function clientOpenEventSidebarItems(events: Pick<PrismEvent, "id" | "eventName" | "eventDate" | "status" | "archived">[]) {
  return orderClientEvents(events.filter((event) => !isPastClientEvent(event)))
    .slice(0, OPEN_EVENT_NAV_LIMIT)
    .map((event) => ({
      id: `${OPEN_EVENT_NAV_PREFIX}${event.id}`,
      label: event.eventName,
      icon: CalendarClock,
      section: "Your events",
      href: dashboardHref("overview", event.id),
    }));
}

/** The event a "Your events" sidebar entry opens. */
export function openEventIdFromNavItem(id: string): string | undefined {
  return id.startsWith(OPEN_EVENT_NAV_PREFIX) ? id.slice(OPEN_EVENT_NAV_PREFIX.length) : undefined;
}

/** The route a portal sidebar entry opens, so the shell can render it as a real link. */
export function clientSidebarLinkHref(id: string, selectedEventId?: string): string | undefined {
  const item = findClientSidebarLink(id);
  if (!item?.route) return undefined;
  if (item.eventScoped && !selectedEventId) return undefined;
  return dashboardHref(item.route, item.eventScoped ? selectedEventId : undefined, portalViewFromLink(item));
}

export function findClientEventNavItem(id: string) {
  return EVENT_WORKSPACE_NAV_ITEMS.find((item) => item.id === id);
}

export const PORTAL_ROUTE_TO_NAV_ITEM: Partial<Record<ClientDashboardRoute, string>> = {
  home: "client-dashboard",
  "shared-floorplans": "my-events",
  request: "client-dashboard",
  events: "my-events",
  calendar: "calendar",
  files: "files",
  billing: "billing-payments",
  messages: "messages",
  privacy: "privacy-requests",
  account: "account",
  notifications: "notifications",
};

/** Account and Privacy live in the account menu, not the sidebar; the ids match those menu entries. */
export const CLIENT_ACCOUNT_MENU_ITEMS: PrismAccountMenuItem[] = [
  { id: "account", label: "Account", icon: UserRound, href: "/dashboard/account" },
  { id: "privacy-requests", label: "Privacy", icon: ShieldCheck, href: "/dashboard/privacy" },
];

export const EVENT_ROUTE_TO_NAV_ITEM: Partial<Record<ClientDashboardRoute, string>> = {
  overview: "event-overview",
  actions: "event-progress",
  progress: "event-progress",
  guests: "event-guests",
  briefing: "event-briefing",
  floorplan: "event-floorplan",
  proposal: "event-proposal",
  documents: "event-files",
  billing: "event-billing",
  payments: "event-billing",
  messages: "event-messages",
  files: "event-files",
  changes: "event-progress",
  summary: "event-closeout",
};

export const ROUTE_TO_DETAIL_TAB: Partial<Record<ClientDashboardRoute, DetailTab>> = {
  overview: "overview",
  actions: "overview",
  progress: "overview",
  guests: "briefing",
  briefing: "briefing",
  proposal: "proposal",
  floorplan: "floorplan",
  documents: "documents",
  billing: "billing",
  payments: "billing",
  messages: "activity",
  files: "documents",
  changes: "activity",
  summary: "overview",
};

export const DETAIL_TAB_TO_ROUTE: Record<DetailTab, ClientDashboardRoute> = {
  overview: "overview",
  activity: "messages",
  briefing: "briefing",
  proposal: "proposal",
  floorplan: "floorplan",
  documents: "documents",
  billing: "billing",
};

export const CLIENT_PORTAL_VIEW_HREFS: Record<ClientPortalView, string> = {
  "dashboard-overview": "/dashboard",
  "dashboard-upcoming-events": "/dashboard/events/upcoming",
  "events-all": "/dashboard/events",
  "events-upcoming": "/dashboard/events/upcoming",
  "events-in-planning": "/dashboard/events/in-planning",
  "events-completed": "/dashboard/events/completed",
  "events-cancelled": "/dashboard/events/cancelled",
  "events-draft-requests": "/dashboard/events/draft-requests",
  "calendar-event-dates": "/dashboard/calendar/event-dates",
  "calendar-meetings": "/dashboard/calendar/meetings",
  "calendar-deadlines": "/dashboard/calendar/deadlines",
  "calendar-payment-due-dates": "/dashboard/calendar/payment-due-dates",
  "files-all": "/dashboard/files",
  "files-contracts": "/dashboard/files/contracts",
  "files-quotations": "/dashboard/files/quotations",
  "files-invoices-receipts": "/dashboard/files/invoices-receipts",
  "files-event-layouts": "/dashboard/files/event-layouts",
  "billing-overview": "/dashboard/billing",
};

export const CLIENT_PORTAL_VIEW_META: Record<ClientPortalView, { title: string; description: string }> = {
  "dashboard-overview": { title: "Home", description: "Your events and the decisions that need your attention." },
  "dashboard-upcoming-events": { title: "Upcoming events", description: "Confirmed PMCM events that still need planning attention." },
  "events-all": { title: "All events", description: "Your confirmed PMCM event workspaces." },
  "events-upcoming": { title: "Upcoming events", description: "Events that are still ahead on the calendar." },
  "events-in-planning": { title: "In planning", description: "Events currently moving through PMCM planning." },
  "events-completed": { title: "Completed events", description: "Finished PMCM events in your client history." },
  "events-cancelled": { title: "Cancelled events", description: "Cancelled or stopped event workspaces." },
  "events-draft-requests": { title: "Draft requests", description: "Start or review event requests before PMCM activates a workspace." },
  "calendar-event-dates": { title: "Event dates", description: "Confirmed event dates across your client portal." },
  "calendar-meetings": { title: "Site visits", description: "Ocular visits PMCM has scheduled with you." },
  "calendar-deadlines": { title: "Due dates", description: "Payment due dates PMCM has set for your events." },
  "calendar-payment-due-dates": { title: "Payment due dates", description: "Payment milestones across active events." },
  "files-all": { title: "Files", description: "Every file for your events, and what PMCM still needs from you." },
  "files-contracts": { title: "Contracts", description: "Conforme, MOA, NDA, and other contract files." },
  "files-quotations": { title: "Quotations", description: "Client-facing quotation files and references." },
  "files-invoices-receipts": { title: "Invoices / Receipts", description: "Invoices, billing statements, receipts, and payment proof." },
  "files-event-layouts": { title: "Event layouts", description: "Official layouts and client-safe floor plan files." },
  "billing-overview": { title: "Billing & Payments", description: "What is due, what you paid, and every payment across your events." },
};

function isPortalChromeView(portalView: ClientPortalView) {
  return (
    !portalView.startsWith("events-") &&
    !portalView.startsWith("dashboard-") &&
    !portalView.startsWith("files-") &&
    !portalView.startsWith("calendar-")
  );
}

export function sidebarActiveItemId(
  route: ClientDashboardRoute,
  eventScoped: boolean,
  portalView?: ClientPortalView,
) {
  if (eventScoped) return "my-events";
  if (portalView && isPortalChromeView(portalView)) return portalView;
  return activeNavItemId(route, false);
}

const PORTAL_HREFS: Partial<Record<ClientDashboardRoute, string>> = {
  home: "/dashboard",
  "shared-floorplans": "/dashboard/shared-floorplans",
  request: "/dashboard/request",
  events: "/dashboard/events",
  calendar: "/dashboard/calendar",
  messages: "/dashboard/messages",
  files: "/dashboard/files",
  billing: "/dashboard/billing",
  privacy: "/dashboard/privacy",
  account: "/dashboard/account",
  notifications: "/dashboard/notifications",
};

const EVENT_PATH_SEGMENT: Partial<Record<ClientDashboardRoute, string>> = {
  floorplan: "floor-plan",
  payments: "billing",
  files: "documents",
};

export function dashboardHref(route: ClientDashboardRoute, eventId?: string, portalView?: ClientPortalView) {
  if (!eventId && portalView) return CLIENT_PORTAL_VIEW_HREFS[portalView];
  if (!eventId) return PORTAL_HREFS[route] ?? "/dashboard/events";
  return `/dashboard/events/${eventId}/${EVENT_PATH_SEGMENT[route] ?? route}`;
}

export function clientEventCardOpenRoute(event: { archived: boolean }): ClientDashboardRoute {
  return event.archived ? "summary" : "overview";
}

export function clientEventWorkspaceAvailable(event: { archived: boolean } | undefined): boolean {
  return Boolean(event && !event.archived);
}

const LOADING_ROUTE_VARIANTS = {
  request: "request",
  events: "events",
  floorplan: "floorplan",
  messages: "messages",
  home: "home",
} as const;

type LoadingRouteVariant = keyof typeof LOADING_ROUTE_VARIANTS;

function isLoadingRouteVariant(route: ClientDashboardRoute): route is LoadingRouteVariant {
  return route in LOADING_ROUTE_VARIANTS;
}

export function dashboardLoadingVariant(route: ClientDashboardRoute) {
  if (isLoadingRouteVariant(route)) return LOADING_ROUTE_VARIANTS[route];
  return "event";
}

export function findClientSidebarLink(id: string): ClientSidebarLink | undefined {
  for (const item of CLIENT_SIDEBAR_ITEMS) {
    if (item.id === id) return item;
    const subItem = item.subItems?.find((candidate) => candidate.id === id);
    if (subItem) return subItem;
  }
  return undefined;
}

export function portalViewFromLink(item: ClientSidebarLink): ClientPortalView | undefined {
  return "icon" in item || item.eventScoped ? undefined : (item.id as ClientPortalView);
}

export function activeNavItemId(route: ClientDashboardRoute, eventScoped: boolean) {
  return (eventScoped ? EVENT_ROUTE_TO_NAV_ITEM[route] : PORTAL_ROUTE_TO_NAV_ITEM[route])
    ?? EVENT_ROUTE_TO_NAV_ITEM[route]
    ?? PORTAL_ROUTE_TO_NAV_ITEM[route]
    ?? "client-dashboard";
}
